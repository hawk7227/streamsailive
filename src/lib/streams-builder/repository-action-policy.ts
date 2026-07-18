export type RepositoryActionPolicyInput = {
  repo: string;
  branch: string;
  path?: string;
  sha?: string;
  operation: "list" | "tree" | "read" | "push";
  allowProtectedBranch?: boolean;
};

export class RepositoryActionPolicyError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "REPOSITORY_ACTION_BLOCKED") {
    super(message);
    this.name = "RepositoryActionPolicyError";
    this.status = status;
    this.code = code;
  }
}

export function cleanRepositoryName(value: string) {
  const repo = String(value || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new RepositoryActionPolicyError("A valid owner/repository name is required.", 400, "REPOSITORY_NAME_INVALID");
  }
  return repo;
}

export function cleanRepositoryPath(value: string) {
  const path = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new RepositoryActionPolicyError("A valid repository file path is required.", 400, "REPOSITORY_PATH_INVALID");
  }
  return path;
}

export function cleanRepositoryBranch(value: string) {
  const branch = String(value || "main").trim();
  if (!branch || /[\s~^:?*\[\\]/.test(branch) || branch.includes("..") || branch.startsWith("/") || branch.endsWith("/")) {
    throw new RepositoryActionPolicyError("A valid Git branch is required.", 400, "REPOSITORY_BRANCH_INVALID");
  }
  return branch;
}

function configuredProtectedBranches() {
  return new Set(
    String(process.env.STREAMS_BUILDER_PROTECTED_BRANCHES || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function enforceRepositoryActionPolicy(input: RepositoryActionPolicyInput) {
  const repo = cleanRepositoryName(input.repo);
  const branch = cleanRepositoryBranch(input.branch);
  const path = input.path ? cleanRepositoryPath(input.path) : "";

  if (input.operation === "push") {
    if (!path || !String(input.sha || "").trim()) {
      throw new RepositoryActionPolicyError("Repository push requires an exact file path and base SHA.", 400, "REPOSITORY_PUSH_SOURCE_REQUIRED");
    }
    if (configuredProtectedBranches().has(branch) && !input.allowProtectedBranch) {
      throw new RepositoryActionPolicyError(
        `Direct push to protected branch ${branch} is disabled. Use the reviewed branch or pull-request workflow.`,
        403,
        "REPOSITORY_PROTECTED_BRANCH",
      );
    }
  }

  return { repo, branch, path, sha: String(input.sha || "").trim() };
}
