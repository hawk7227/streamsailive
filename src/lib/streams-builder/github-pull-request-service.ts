import { cleanRepositoryBranch, cleanRepositoryName, RepositoryActionPolicyError } from "./repository-action-policy";

const GITHUB_API = "https://api.github.com";

export class GitHubPullRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "GITHUB_PULL_REQUEST_FAILED") {
    super(message);
    this.name = "GitHubPullRequestError";
    this.status = status;
    this.code = code;
  }
}

function token() {
  const value = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (!value) throw new GitHubPullRequestError("Missing GITHUB_TOKEN or GH_TOKEN in the deployment environment.", 400, "GITHUB_TOKEN_MISSING");
  return value;
}

async function github<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new GitHubPullRequestError(data.message || `GitHub request failed with status ${response.status}.`, response.status, "GITHUB_REQUEST_FAILED");
  return data;
}

type CreatePullRequestInput = {
  repo: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  previewUrl?: string;
  checkpointId?: string;
  filePath?: string;
  proofStatus?: string;
  verificationStatus?: string;
};

type ApprovalState = "approved" | "changes-requested" | "review-requested" | "review-required";

function reviewState(pr: any, reviews: any[]): ApprovalState {
  const latestByReviewer = new Map<string, string>();
  for (const review of reviews) {
    const login = String(review?.user?.login || "");
    if (!login) continue;
    latestByReviewer.set(login, String(review?.state || "").toUpperCase());
  }
  const states = Array.from(latestByReviewer.values());
  if (states.includes("CHANGES_REQUESTED")) return "changes-requested";
  if (states.includes("APPROVED")) return "approved";
  if (Array.isArray(pr?.requested_reviewers) && pr.requested_reviewers.length > 0) return "review-requested";
  return "review-required";
}

function normalizePullRequest(pr: any, checks: any[] = [], reviews: any[] = []) {
  const successfulChecks = checks.length > 0 && checks.every((check) => ["success", "neutral", "skipped"].includes(String(check.conclusion || "")));
  const approvalState = reviewState(pr, reviews);
  return {
    number: Number(pr?.number || 0),
    url: String(pr?.html_url || ""),
    title: String(pr?.title || ""),
    state: String(pr?.state || "unknown"),
    draft: Boolean(pr?.draft),
    baseBranch: String(pr?.base?.ref || ""),
    headBranch: String(pr?.head?.ref || ""),
    headSha: String(pr?.head?.sha || ""),
    mergeable: pr?.mergeable ?? null,
    mergeableState: String(pr?.mergeable_state || "unknown"),
    approvalState,
    checks: checks.map((check) => ({ name: check.name, status: check.status, conclusion: check.conclusion, url: check.details_url || "" })),
    checksPassed: successfulChecks,
    mergeAllowed: successfulChecks && approvalState === "approved" && pr?.mergeable === true,
  };
}

export class GitHubPullRequestService {
  async create(input: CreatePullRequestInput) {
    const repo = cleanRepositoryName(input.repo);
    const base = cleanRepositoryBranch(input.baseBranch);
    const head = cleanRepositoryBranch(input.headBranch);
    if (base === head) throw new GitHubPullRequestError("Pull request head branch must differ from the base branch.", 400, "PULL_REQUEST_BRANCHES_MATCH");
    const owner = repo.split("/")[0];
    const existing = await github<any[]>(`/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`);
    if (existing[0]) return { created: false, pullRequest: normalizePullRequest(existing[0]) };

    const body = [
      "## Streams Builder reviewed change",
      "",
      input.previewUrl ? `Preview: ${input.previewUrl}` : "Preview: unavailable",
      input.filePath ? `Changed file: \`${input.filePath}\`` : "",
      input.checkpointId ? `Checkpoint: \`${input.checkpointId}\`` : "",
      `Proof status: ${input.proofStatus || "pending"}`,
      `Verification status: ${input.verificationStatus || "pending"}`,
      "",
      "This pull request was created from the verified temporary preview branch. Merge remains gated by repository review and checks.",
    ].filter(Boolean).join("\n");

    const created = await github<any>(`/repos/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title: input.title, head, base, body, draft: false }),
    });
    return { created: true, pullRequest: normalizePullRequest(created) };
  }

  async read(repoInput: string, number: number) {
    const repo = cleanRepositoryName(repoInput);
    if (!Number.isInteger(number) || number <= 0) throw new GitHubPullRequestError("A valid pull request number is required.", 400, "PULL_REQUEST_NUMBER_INVALID");
    const pr = await github<any>(`/repos/${repo}/pulls/${number}`);
    const [checksResponse, reviews] = await Promise.all([
      pr?.head?.sha
        ? github<{ check_runs?: any[] }>(`/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`)
        : Promise.resolve({ check_runs: [] }),
      github<any[]>(`/repos/${repo}/pulls/${number}/reviews?per_page=100`),
    ]);
    return normalizePullRequest(pr, checksResponse.check_runs || [], reviews || []);
  }
}

export function pullRequestError(error: unknown) {
  if (error instanceof GitHubPullRequestError || error instanceof RepositoryActionPolicyError) {
    return { status: error.status, body: { ok: false, error: error.message, code: error.code } };
  }
  return { status: 500, body: { ok: false, error: error instanceof Error ? error.message : "Unknown pull request error" } };
}
