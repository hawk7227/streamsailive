import { NextResponse } from "next/server";
import {
  createProjectContainer,
  createSnapshot,
  emptyRepositoryTruth,
  normalizeRepository,
  type RepositoryTruth,
  type StreamsBuilderWorkspaceId,
} from "@/lib/streams-builder/source-truth-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GitHubRepoResponse = {
  name?: string;
  full_name?: string;
  default_branch?: string;
  pushed_at?: string;
  updated_at?: string;
  html_url?: string;
};

type GitHubBranchResponse = Array<{ name: string; protected?: boolean }>;

type GitHubCommitResponse = Array<{
  sha: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { name?: string | null; date?: string | null };
  };
}>;

type GitHubPullResponse = Array<{
  number: number;
  title: string;
  state: string;
  html_url?: string;
  head?: { ref?: string | null };
}>;

function requestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function loadRepositoryTruth(repository: string): Promise<RepositoryTruth> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return emptyRepositoryTruth(repository);

  const base = `https://api.github.com/repos/${repository}`;
  try {
    const [repo, branches, commits, pulls] = await Promise.all([
      githubJson<GitHubRepoResponse>(base, token),
      githubJson<GitHubBranchResponse>(`${base}/branches?per_page=20`, token),
      githubJson<GitHubCommitResponse>(`${base}/commits?per_page=10`, token),
      githubJson<GitHubPullResponse>(`${base}/pulls?state=all&per_page=10`, token),
    ]);

    const health: RepositoryTruth["repositoryHealth"] = [
      { name: "GitHub execution", status: "running", detail: "Live GitHub repository reads are connected." },
      { name: "Branches", status: branches.length > 0 ? "running" : "unknown", detail: `${branches.length} branches returned by GitHub.` },
      { name: "Commits", status: commits.length > 0 ? "running" : "unknown", detail: `${commits.length} commits returned by GitHub.` },
      { name: "Pull requests", status: pulls.length > 0 ? "ready-for-approval" : "unknown", detail: `${pulls.length} pull requests returned by GitHub.` },
    ];

    return {
      repository,
      defaultBranch: repo.default_branch || null,
      pushedAt: repo.pushed_at || null,
      updatedAt: repo.updated_at || null,
      htmlUrl: repo.html_url || `https://github.com/${repository}`,
      gitStatus: "Live remote repository data loaded from GitHub. Local working-tree dirty state requires the execution worker checkout.",
      modifiedFiles: [],
      untrackedFiles: [],
      branches: branches.map((branch) => ({ name: branch.name, protected: Boolean(branch.protected) })),
      commits: commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit?.message || "No commit message",
        author: commit.commit?.author?.name || null,
        date: commit.commit?.author?.date || null,
        url: commit.html_url || null,
      })),
      pullRequests: pulls.map((pull) => ({
        number: pull.number,
        title: pull.title,
        state: pull.state,
        url: pull.html_url || null,
        branch: pull.head?.ref || null,
      })),
      repositoryHealth: health,
    };
  } catch (error) {
    return emptyRepositoryTruth(repository, error instanceof Error ? error.message : "GitHub repository read failed.");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repository = normalizeRepository(url.searchParams.get("repository") || process.env.STREAMS_BUILDER_REPOSITORY || "hawk7227/streamsailive");
  const projectId = url.searchParams.get("projectId") || undefined;
  const activeWorkspaceId = (url.searchParams.get("workspaceId") || undefined) as StreamsBuilderWorkspaceId | undefined;

  const repositoryTruth = await loadRepositoryTruth(repository);
  const project = createProjectContainer({
    projectId,
    repository,
    owner: repository.split("/")[0],
    name: repository.split("/")[1] || "Streams Builder",
    status: repositoryTruth.repositoryHealth.some((item) => item.status === "not-configured" || item.status === "failed") ? "not-configured" : "running",
  });

  const snapshot = createSnapshot({
    project,
    repositoryTruth,
    origin: requestOrigin(request),
    activeWorkspaceId,
  });

  return NextResponse.json({ ok: true, snapshot });
}
