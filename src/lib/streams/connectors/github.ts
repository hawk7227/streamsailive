/**
 * src/lib/streams/connectors/github.ts
 *
 * GitHub connector adapter — Phase 7.
 *
 * All calls use a personal access token (PAT) stored encrypted.
 * Token is decrypted server-side, used, and never logged or returned.
 *
 * Actions:
 *   validateToken()    — verify token is valid, return scopes + username
 *   getRepo()          — get repository metadata
 *   getBranch()        — get branch info + latest commit
 *   listCommits()      — recent commits on a branch
 *   getWorkflowRuns()  — CI status for latest runs
 *   createIssue()      — create a GitHub issue (destructive — logged)
 *   pushStatus()       — read latest push status
 */

const GITHUB_API = "https://api.github.com";

export interface GitHubValidation {
  valid:    boolean;
  username: string | null;
  scopes:   string[];
  error?:   string;
}

export interface GitHubCommit {
  sha:     string;
  message: string;
  author:  string;
  date:    string;
  url:     string;
}

export interface GitHubWorkflowRun {
  id:         number;
  name:       string;
  status:     string;
  conclusion: string | null;
  branch:     string;
  commit:     string;
  url:        string;
  createdAt:  string;
  updatedAt:  string;
}

export interface GitHubRepo {
  name:          string;
  fullName:      string;
  defaultBranch: string;
  private:       boolean;
  url:           string;
  lastPushedAt:  string | null;
}

// ── Headers ───────────────────────────────────────────────────────────────────

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept:        "application/vnd.github+json",
    "User-Agent":  "Streams-Builder/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── Validate token ────────────────────────────────────────────────────────────

export async function validateGitHubToken(token: string): Promise<GitHubValidation> {
  try {
    const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });

    if (!res.ok) {
      return { valid: false, username: null, scopes: [], error: `HTTP ${res.status}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const scopeHeader = res.headers.get("x-oauth-scopes") ?? "";
    const scopes = scopeHeader ? scopeHeader.split(",").map(s => s.trim()) : [];

    return {
      valid:    true,
      username: data.login as string,
      scopes,
    };
  } catch (err) {
    return {
      valid:    false,
      username: null,
      scopes:   [],
      error:    err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Get repository ────────────────────────────────────────────────────────────

export async function getGitHubRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: headers(token),
  });

  if (!res.ok) return null;

  const data = await res.json() as Record<string, unknown>;
  return {
    name:          data.name as string,
    fullName:      data.full_name as string,
    defaultBranch: data.default_branch as string,
    private:       data.private as boolean,
    url:           data.html_url as string,
    lastPushedAt:  data.pushed_at as string | null,
  };
}

// ── Get branch info ───────────────────────────────────────────────────────────

export async function getGitHubBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ sha: string; message: string; date: string } | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/branches/${branch}`,
    { headers: headers(token) }
  );

  if (!res.ok) return null;

  const data  = await res.json() as Record<string, unknown>;
  const commit = data.commit as Record<string, unknown>;
  const commitData = commit?.commit as Record<string, unknown>;
  const committer  = commitData?.committer as Record<string, unknown>;

  return {
    sha:     commit?.sha as string,
    message: (commitData?.message as string)?.split("\n")[0] ?? "",
    date:    committer?.date as string,
  };
}

// ── List recent commits ───────────────────────────────────────────────────────

export async function listGitHubCommits(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  limit = 10,
): Promise<GitHubCommit[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`,
    { headers: headers(token) }
  );

  if (!res.ok) return [];

  const data = await res.json() as Record<string, unknown>[];
  return data.map(c => {
    const commit    = c.commit as Record<string, unknown>;
    const author    = commit?.author as Record<string, unknown>;
    const committer = c.author as Record<string, unknown>;
    return {
      sha:     c.sha as string,
      message: (commit?.message as string)?.split("\n")[0] ?? "",
      author:  (committer?.login as string) ?? (author?.name as string) ?? "unknown",
      date:    author?.date as string,
      url:     c.html_url as string,
    };
  });
}

// ── Get workflow runs (CI status) ─────────────────────────────────────────────

export async function getGitHubWorkflowRuns(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  limit = 5,
): Promise<GitHubWorkflowRun[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/runs?branch=${branch}&per_page=${limit}`,
    { headers: headers(token) }
  );

  if (!res.ok) return [];

  const data = await res.json() as Record<string, unknown>;
  const runs  = (data.workflow_runs as Record<string, unknown>[]) ?? [];

  return runs.map(r => ({
    id:         r.id as number,
    name:       r.name as string,
    status:     r.status as string,
    conclusion: r.conclusion as string | null,
    branch:     r.head_branch as string,
    commit:     r.head_sha as string,
    url:        r.html_url as string,
    createdAt:  r.created_at as string,
    updatedAt:  r.updated_at as string,
  }));
}

// ── Create issue (destructive — must be logged by caller) ─────────────────────

export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[],
): Promise<{ number: number; url: string } | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, labels: labels ?? [] }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json() as Record<string, unknown>;
  return {
    number: data.number as number,
    url:    data.html_url as string,
  };
}
