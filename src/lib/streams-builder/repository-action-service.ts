import {
  enforceRepositoryActionPolicy,
  RepositoryActionPolicyError,
  type RepositoryActionPolicyInput,
} from "./repository-action-policy";

const GITHUB_API = "https://api.github.com";

export class RepositoryActionServiceError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, status = 500, code = "REPOSITORY_ACTION_FAILED", detail?: unknown) {
    super(message);
    this.name = "RepositoryActionServiceError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
};

type GitTreeItem = {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
};

function githubToken() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (!token) {
    throw new RepositoryActionServiceError(
      "Missing GITHUB_TOKEN or GH_TOKEN in the deployment environment.",
      400,
      "GITHUB_TOKEN_MISSING",
    );
  }
  return token;
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${githubToken()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...githubHeaders(), ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) {
    throw new RepositoryActionServiceError(
      data?.message || `GitHub request failed with status ${response.status}.`,
      response.status,
      "GITHUB_REQUEST_FAILED",
      data,
    );
  }
  return data;
}

function usefulFile(path: string) {
  return /\.(tsx|jsx|ts|js|css|scss|json|md|mdx|html|liquid)$/i.test(path);
}

export function inferFrontendRoute(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  if (/src\/app\/.+\/page\.(tsx|jsx|ts|js)$/i.test(normalized)) {
    return normalized.replace(/^src\/app/i, "").replace(/\/page\.(tsx|jsx|ts|js)$/i, "") || "/";
  }
  if (normalized.includes("streams-builder")) return "/streams-builder";
  if (normalized.toLowerCase().includes("pricing")) return "/pricing";
  if (normalized.toLowerCase().includes("dashboard")) return "/dashboard";
  if (normalized.toLowerCase().includes("admingeneration")) return "/admingeneration";
  if (normalized.toLowerCase().includes("visual-editor")) return "/visual-editor";
  return "/";
}

export class RepositoryActionService {
  async listRepositories() {
    const data = await githubRequest<GitHubRepository[]>("/user/repos?per_page=100&sort=updated");
    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      updatedAt: repo.updated_at,
    }));
  }

  async readTree(input: Pick<RepositoryActionPolicyInput, "repo" | "branch">) {
    const { repo, branch } = enforceRepositoryActionPolicy({ ...input, operation: "tree" });
    const data = await githubRequest<{ tree?: GitTreeItem[]; truncated?: boolean }>(
      `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
    const files = (data.tree || [])
      .filter((item) => item.type === "blob")
      .filter((item) => usefulFile(item.path))
      .map((item) => ({
        path: item.path,
        sha: item.sha,
        size: item.size || 0,
        name: item.path.split("/").pop() || item.path,
        directory: item.path.includes("/") ? item.path.split("/").slice(0, -1).join("/") : "",
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return {
      repo,
      ref: branch,
      files,
      directories: Array.from(new Set(files.map((file) => file.directory).filter(Boolean))).sort(),
      truncated: Boolean(data.truncated),
    };
  }

  async readFile(input: Pick<RepositoryActionPolicyInput, "repo" | "branch" | "path">) {
    const { repo, branch, path } = enforceRepositoryActionPolicy({ ...input, operation: "read" });
    const data = await githubRequest<{
      type?: string;
      content?: string;
      sha?: string;
      size?: number;
    }>(`/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}?ref=${encodeURIComponent(branch)}`);
    if (data.type !== "file" || !data.content) {
      throw new RepositoryActionServiceError("Selected path is not a readable file.", 400, "GITHUB_PATH_NOT_FILE");
    }
    const content = Buffer.from(String(data.content).replace(/\n/g, ""), "base64").toString("utf8");
    const route = inferFrontendRoute(path);
    const component = path.split("/").pop()?.replace(/\.(tsx|jsx|ts|js)$/i, "") || "Unknown";
    return {
      repo,
      path,
      ref: branch,
      sha: data.sha || "",
      size: data.size || 0,
      content,
      frontendRoute: route,
      sourceTruth: {
        route,
        component,
        file: path,
        githubPath: path,
        branch,
        writeTarget: `${branch}/${path}`,
        mode: branch === "main" ? "Main File Only" : "Branch Selected",
        branchWrites: "Station isolated",
      },
    };
  }

  async pushFile(input: {
    repo: string;
    branch: string;
    path: string;
    sha: string;
    content: string;
    message: string;
    allowProtectedBranch?: boolean;
  }) {
    const { repo, branch, path, sha } = enforceRepositoryActionPolicy({
      ...input,
      operation: "push",
    });
    const data = await githubRequest<{ commit?: { sha?: string } }>(
      `/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: input.message,
          content: Buffer.from(input.content, "utf8").toString("base64"),
          sha,
          branch,
        }),
      },
    );
    return {
      commitSha: data.commit?.sha || null,
      path,
      repo,
      branch,
    };
  }
}

export function repositoryActionError(error: unknown) {
  if (error instanceof RepositoryActionPolicyError || error instanceof RepositoryActionServiceError) {
    return { status: error.status, body: { ok: false, error: error.message, code: error.code } };
  }
  return {
    status: 500,
    body: { ok: false, error: error instanceof Error ? error.message : "Unknown repository action error" },
  };
}
