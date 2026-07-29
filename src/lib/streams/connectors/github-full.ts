const GITHUB_API = "https://api.github.com";

type GitHubMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type GitHubRequestOptions = {
  method?: GitHubMethod;
  body?: unknown;
  accept?: string;
};

function githubHeaders(token: string, accept = "application/vnd.github+json"): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "Content-Type": "application/json",
    "User-Agent": "Streams-AI/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest<T>(
  token: string,
  path: string,
  options: GitHubRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method: options.method || "GET",
    headers: githubHeaders(token, options.accept),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `GitHub request failed: ${response.status}`);
  }

  if (response.status === 204) return null as T;
  return await response.json() as T;
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function encodeBase64Utf8(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function listGitHubRepositories(token: string, options: { visibility?: string; affiliation?: string; perPage?: number; page?: number } = {}) {
  const params = new URLSearchParams({
    visibility: options.visibility || "all",
    affiliation: options.affiliation || "owner,collaborator,organization_member",
    per_page: String(Math.min(options.perPage || 100, 100)),
    page: String(options.page || 1),
    sort: "updated",
  });
  return githubRequest<any[]>(token, `/user/repos?${params}`);
}

export async function getGitHubRepository(token: string, owner: string, repo: string) {
  return githubRequest<any>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

export async function listGitHubBranches(token: string, owner: string, repo: string, perPage = 100) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/branches?per_page=${Math.min(perPage, 100)}`);
}

export async function getGitHubBranch(token: string, owner: string, repo: string, branch: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
}

export async function createGitHubBranch(token: string, owner: string, repo: string, branch: string, sha: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branch}`, sha },
  });
}

export async function updateGitHubBranchRef(token: string, owner: string, repo: string, branch: string, sha: string, force = false) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: { sha, force },
  });
}

export async function deleteGitHubBranch(token: string, owner: string, repo: string, branch: string) {
  return githubRequest<null>(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "DELETE" });
}

export async function listGitHubTags(token: string, owner: string, repo: string, perPage = 100) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/tags?per_page=${Math.min(perPage, 100)}`);
}

export async function createGitHubTag(token: string, owner: string, repo: string, input: { tag: string; message: string; object: string; type?: "commit" | "tree" | "blob"; tagger?: Record<string, unknown> }) {
  const tag = await githubRequest<any>(token, `/repos/${owner}/${repo}/git/tags`, {
    method: "POST",
    body: { ...input, type: input.type || "commit" },
  });
  return githubRequest<any>(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: { ref: `refs/tags/${input.tag}`, sha: tag.sha },
  });
}

export async function listGitHubCommits(token: string, owner: string, repo: string, options: { sha?: string; path?: string; perPage?: number } = {}) {
  const params = new URLSearchParams({ per_page: String(Math.min(options.perPage || 100, 100)) });
  if (options.sha) params.set("sha", options.sha);
  if (options.path) params.set("path", options.path);
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/commits?${params}`);
}

export async function getGitHubCommit(token: string, owner: string, repo: string, ref: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`);
}

export async function compareGitHubCommits(token: string, owner: string, repo: string, base: string, head: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
}

export async function getGitHubTree(token: string, owner: string, repo: string, treeSha: string, recursive = true) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeSha)}?recursive=${recursive ? "1" : "0"}`);
}

export async function getGitHubContent(token: string, owner: string, repo: string, path: string, ref?: string) {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return githubRequest<any>(token, `/repos/${owner}/${repo}/contents/${encodePath(path)}${suffix}`);
}

export async function createOrUpdateGitHubFile(token: string, owner: string, repo: string, input: { path: string; content: string; message: string; branch?: string; sha?: string; committer?: Record<string, string>; author?: Record<string, string> }) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/contents/${encodePath(input.path)}`, {
    method: "PUT",
    body: {
      message: input.message,
      content: encodeBase64Utf8(input.content),
      branch: input.branch,
      sha: input.sha,
      committer: input.committer,
      author: input.author,
    },
  });
}

export async function deleteGitHubFile(token: string, owner: string, repo: string, input: { path: string; message: string; sha: string; branch?: string }) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/contents/${encodePath(input.path)}`, {
    method: "DELETE",
    body: input,
  });
}

export async function commitMultipleGitHubFiles(token: string, owner: string, repo: string, input: { branch: string; message: string; files: Array<{ path: string; content?: string; delete?: boolean }> }) {
  const ref = await githubRequest<any>(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(input.branch)}`);
  const parentSha = ref.object.sha as string;
  const parentCommit = await githubRequest<any>(token, `/repos/${owner}/${repo}/git/commits/${parentSha}`);

  const tree: Array<Record<string, unknown>> = [];
  for (const file of input.files) {
    if (file.delete) {
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await githubRequest<any>(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: { content: file.content || "", encoding: "utf-8" },
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await githubRequest<any>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: { base_tree: parentCommit.tree.sha, tree },
  });
  const commit = await githubRequest<any>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: { message: input.message, tree: newTree.sha, parents: [parentSha] },
  });
  await updateGitHubBranchRef(token, owner, repo, input.branch, commit.sha, false);
  return commit;
}

export async function searchGitHubCode(token: string, query: string, perPage = 100) {
  return githubRequest<any>(token, `/search/code?q=${encodeURIComponent(query)}&per_page=${Math.min(perPage, 100)}`);
}

export async function searchGitHubCommits(token: string, query: string, perPage = 100) {
  return githubRequest<any>(token, `/search/commits?q=${encodeURIComponent(query)}&per_page=${Math.min(perPage, 100)}`);
}

export async function searchGitHubIssuesAndPullRequests(token: string, query: string, perPage = 100) {
  return githubRequest<any>(token, `/search/issues?q=${encodeURIComponent(query)}&per_page=${Math.min(perPage, 100)}`);
}

export async function searchGitHubRepositories(token: string, query: string, perPage = 100) {
  return githubRequest<any>(token, `/search/repositories?q=${encodeURIComponent(query)}&per_page=${Math.min(perPage, 100)}`);
}

export async function searchGitHubUsers(token: string, query: string, perPage = 100) {
  return githubRequest<any>(token, `/search/users?q=${encodeURIComponent(query)}&per_page=${Math.min(perPage, 100)}`);
}

export async function listGitHubIssues(token: string, owner: string, repo: string, state: "open" | "closed" | "all" = "open") {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
}

export async function createGitHubIssue(token: string, owner: string, repo: string, input: { title: string; body?: string; labels?: string[]; assignees?: string[]; milestone?: number }) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/issues`, { method: "POST", body: input });
}

export async function updateGitHubIssue(token: string, owner: string, repo: string, issueNumber: number, input: Record<string, unknown>) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/issues/${issueNumber}`, { method: "PATCH", body: input });
}

export async function addGitHubIssueComment(token: string, owner: string, repo: string, issueNumber: number, body: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { method: "POST", body: { body } });
}

export async function listGitHubIssueComments(token: string, owner: string, repo: string, issueNumber: number) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
}

export async function listGitHubLabels(token: string, owner: string, repo: string) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/labels?per_page=100`);
}

export async function createGitHubLabel(token: string, owner: string, repo: string, input: { name: string; color: string; description?: string }) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/labels`, { method: "POST", body: input });
}

export async function updateGitHubLabel(token: string, owner: string, repo: string, currentName: string, input: Record<string, unknown>) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/labels/${encodeURIComponent(currentName)}`, { method: "PATCH", body: input });
}

export async function deleteGitHubLabel(token: string, owner: string, repo: string, name: string) {
  return githubRequest<null>(token, `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function listGitHubPullRequests(token: string, owner: string, repo: string, state: "open" | "closed" | "all" = "open") {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
}

export async function getGitHubPullRequest(token: string, owner: string, repo: string, pullNumber: number) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/pulls/${pullNumber}`);
}

export async function createGitHubPullRequest(token: string, owner: string, repo: string, input: { title: string; head: string; base: string; body?: string; draft?: boolean; maintainer_can_modify?: boolean }) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/pulls`, { method: "POST", body: input });
}

export async function updateGitHubPullRequest(token: string, owner: string, repo: string, pullNumber: number, input: Record<string, unknown>) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/pulls/${pullNumber}`, { method: "PATCH", body: input });
}

export async function listGitHubPullRequestFiles(token: string, owner: string, repo: string, pullNumber: number) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`);
}

export async function listGitHubPullRequestReviews(token: string, owner: string, repo: string, pullNumber: number) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`);
}

export async function createGitHubPullRequestReview(token: string, owner: string, repo: string, pullNumber: number, input: { body?: string; event?: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"; comments?: Array<Record<string, unknown>> }) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, { method: "POST", body: input });
}

export async function mergeGitHubPullRequest(token: string, owner: string, repo: string, pullNumber: number, input: { commit_title?: string; commit_message?: string; sha?: string; merge_method?: "merge" | "squash" | "rebase" } = {}) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, { method: "PUT", body: input });
}

export async function listGitHubReleases(token: string, owner: string, repo: string) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/releases?per_page=100`);
}

export async function createGitHubRelease(token: string, owner: string, repo: string, input: Record<string, unknown>) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/releases`, { method: "POST", body: input });
}

export async function updateGitHubRelease(token: string, owner: string, repo: string, releaseId: number, input: Record<string, unknown>) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/releases/${releaseId}`, { method: "PATCH", body: input });
}

export async function deleteGitHubRelease(token: string, owner: string, repo: string, releaseId: number) {
  return githubRequest<null>(token, `/repos/${owner}/${repo}/releases/${releaseId}`, { method: "DELETE" });
}

export async function listGitHubWorkflows(token: string, owner: string, repo: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/actions/workflows?per_page=100`);
}

export async function listGitHubWorkflowRuns(token: string, owner: string, repo: string, options: { branch?: string; status?: string; perPage?: number } = {}) {
  const params = new URLSearchParams({ per_page: String(Math.min(options.perPage || 100, 100)) });
  if (options.branch) params.set("branch", options.branch);
  if (options.status) params.set("status", options.status);
  return githubRequest<any>(token, `/repos/${owner}/${repo}/actions/runs?${params}`);
}

export async function getGitHubWorkflowRun(token: string, owner: string, repo: string, runId: number) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/actions/runs/${runId}`);
}

export async function rerunGitHubWorkflow(token: string, owner: string, repo: string, runId: number, failedOnly = false) {
  const endpoint = failedOnly ? "rerun-failed-jobs" : "rerun";
  return githubRequest<null>(token, `/repos/${owner}/${repo}/actions/runs/${runId}/${endpoint}`, { method: "POST" });
}

export async function cancelGitHubWorkflowRun(token: string, owner: string, repo: string, runId: number) {
  return githubRequest<null>(token, `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`, { method: "POST" });
}

export async function listGitHubCheckRuns(token: string, owner: string, repo: string, ref: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/check-runs`, { accept: "application/vnd.github+json" });
}

export async function getGitHubCombinedStatus(token: string, owner: string, repo: string, ref: string) {
  return githubRequest<any>(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/status`);
}

export async function listGitHubDeployments(token: string, owner: string, repo: string, options: { ref?: string; environment?: string } = {}) {
  const params = new URLSearchParams();
  if (options.ref) params.set("ref", options.ref);
  if (options.environment) params.set("environment", options.environment);
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/deployments${params.toString() ? `?${params}` : ""}`);
}

export async function listGitHubDeploymentStatuses(token: string, owner: string, repo: string, deploymentId: number) {
  return githubRequest<any[]>(token, `/repos/${owner}/${repo}/deployments/${deploymentId}/statuses?per_page=100`);
}

export async function getGitHubDiff(token: string, owner: string, repo: string, base: string, head: string) {
  return githubRequest<string>(token, `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, {
    accept: "application/vnd.github.v3.diff",
  });
}
