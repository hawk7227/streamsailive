/**
 * src/lib/connector/adapters.ts
 *
 * Provider adapters for the Connector Action Layer.
 *
 * Each adapter:
 * 1. Accepts a resolved context (token + project bindings)
 * 2. Executes a specific operation against the provider API
 * 3. Returns structured result — never raw API response
 * 4. Sanitises output before returning (no token echoing)
 *
 * These are the ONLY files allowed to hold a live decrypted token in memory.
 * Tokens are used immediately and never stored or passed further.
 */

// ── GitHub Adapter ────────────────────────────────────────────────────────────

export interface GitHubRepo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
  pushedAt: string | null;
}

export interface GitHubDeploymentStatus {
  sha: string;
  ref: string;
  commitMessage: string;
  author: string;
  pushedAt: string;
  checksUrl: string;
}

export interface GitHubPushResult {
  sha: string;
  ref: string;
  url: string;
  commitMessage: string;
}

export interface GitHubValidation {
  login: string;
  id: number;
  scopes: string[];
  rateLimit: { remaining: number; limit: number };
}

/**
 * Validate a GitHub token — returns account info and current rate limit.
 */
export async function validateGitHubToken(token: string): Promise<GitHubValidation> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub validation failed: ${res.status} ${body.message ?? res.statusText}`);
  }

  const user = await res.json();
  const scopeHeader = res.headers.get("x-oauth-scopes") ?? "";
  const scopes = scopeHeader.split(",").map((s) => s.trim()).filter(Boolean);
  const remaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "0");
  const limit = parseInt(res.headers.get("x-ratelimit-limit") ?? "0");

  return {
    login: user.login,
    id: user.id,
    scopes,
    rateLimit: { remaining, limit },
  };
}

/**
 * Get repository info.
 */
export async function getGitHubRepo(token: string, repo: string): Promise<GitHubRepo> {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub repo fetch failed: ${res.status} for ${repo}`);
  }

  const data = await res.json();
  return {
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    private: data.private,
    url: data.html_url,
    pushedAt: data.pushed_at ?? null,
  };
}

/**
 * Get the latest commit on a branch.
 */
export async function getLatestCommit(
  token: string,
  repo: string,
  branch: string
): Promise<GitHubDeploymentStatus> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub commit fetch failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    sha: data.sha,
    ref: branch,
    commitMessage: data.commit?.message ?? "",
    author: data.commit?.author?.name ?? data.author?.login ?? "unknown",
    pushedAt: data.commit?.author?.date ?? "",
    checksUrl: `https://api.github.com/repos/${repo}/commits/${data.sha}/check-runs`,
  };
}

/**
 * List repositories accessible to the token.
 */
export async function listGitHubRepos(
  token: string,
  limit = 30
): Promise<GitHubRepo[]> {
  const res = await fetch(
    `https://api.github.com/user/repos?per_page=${limit}&sort=updated`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub repo list failed: ${res.status}`);
  }

  const data = await res.json();
  return data.map((r: Record<string, unknown>) => ({
    fullName: r.full_name as string,
    defaultBranch: r.default_branch as string,
    private: r.private as boolean,
    url: r.html_url as string,
    pushedAt: (r.pushed_at as string) ?? null,
  }));
}

// ── Vercel Adapter ────────────────────────────────────────────────────────────

export interface VercelDeployment {
  id: string;
  url: string;
  state: "BUILDING" | "ERROR" | "INITIALIZING" | "QUEUED" | "READY" | "CANCELED";
  createdAt: number;
  target: "production" | "preview" | null;
  meta: { githubCommitSha?: string; githubCommitMessage?: string };
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  latestDeploymentUrl: string | null;
}

export interface VercelValidation {
  id: string;
  username: string;
  email: string;
  plan: string;
}

/**
 * Validate a Vercel token.
 */
export async function validateVercelToken(token: string): Promise<VercelValidation> {
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Vercel validation failed: ${res.status} ${body.error?.message ?? ""}`);
  }

  const data = await res.json();
  const user = data.user;
  return {
    id: user.id ?? user.uid,
    username: user.username,
    email: user.email,
    plan: user.softBlock?.blockedDueToOverdue ? "blocked" : "active",
  };
}

/**
 * Get latest deployment for a project.
 */
export async function getLatestDeployment(
  token: string,
  projectId: string,
  teamId?: string | null
): Promise<VercelDeployment | null> {
  const params = new URLSearchParams({ projectId, limit: "1", target: "production" });
  if (teamId) params.set("teamId", teamId);

  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Vercel deployment fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const deployments = data.deployments ?? [];
  if (!deployments.length) return null;

  const d = deployments[0];
  return {
    id: d.uid,
    url: d.url,
    state: d.state,
    createdAt: d.createdAt,
    target: d.target ?? null,
    meta: {
      githubCommitSha: d.meta?.githubCommitSha,
      githubCommitMessage: d.meta?.githubCommitMessage,
    },
  };
}

/**
 * Poll a deployment until it reaches a terminal state.
 * Returns the final deployment state.
 */
export async function pollDeployment(
  token: string,
  deploymentId: string,
  teamId?: string | null,
  maxAttempts = 30,
  intervalMs = 8000
): Promise<VercelDeployment> {
  const params = teamId ? `?teamId=${teamId}` : "";

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error(`Vercel poll failed: ${res.status}`);
    const d = await res.json();

    const state = d.readyState ?? d.state;
    if (["READY", "ERROR", "CANCELED"].includes(state)) {
      return {
        id: d.id ?? deploymentId,
        url: d.url ?? "",
        state,
        createdAt: d.createdAt,
        target: d.target ?? null,
        meta: {
          githubCommitSha: d.meta?.githubCommitSha,
          githubCommitMessage: d.meta?.githubCommitMessage,
        },
      };
    }

    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  throw new Error(`Vercel deployment ${deploymentId} did not reach terminal state in time.`);
}

/**
 * Get Vercel project info.
 */
export async function getVercelProject(
  token: string,
  projectId: string,
  teamId?: string | null
): Promise<VercelProject> {
  const params = teamId ? `?teamId=${teamId}` : "";
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Vercel project fetch failed: ${res.status}`);
  const d = await res.json();
  return {
    id: d.id,
    name: d.name,
    framework: d.framework ?? null,
    updatedAt: d.updatedAt,
    latestDeploymentUrl: d.latestDeployments?.[0]?.url ?? null,
  };
}

// ── Supabase Adapter ──────────────────────────────────────────────────────────

export interface SupabaseProjectInfo {
  id: string;
  name: string;
  region: string;
  status: string;
  dbVersion: string;
}

export interface SupabaseMigrationResult {
  ran: boolean;
  durationMs: number;
  error: string | null;
}

/**
 * Validate a Supabase service role key by making a simple authenticated request.
 */
export async function validateSupabaseKey(
  projectUrl: string,
  serviceRoleKey: string
): Promise<{ valid: boolean; projectRef: string }> {
  const projectRef = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

  const res = await fetch(`${projectUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  // A 200 or 404 (no tables) both indicate a valid key
  if (res.ok || res.status === 404) {
    return { valid: true, projectRef };
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Supabase key validation failed: invalid credentials`);
  }

  throw new Error(`Supabase validation failed: ${res.status}`);
}

/**
 * Run a SQL migration against a Supabase project.
 * Uses the Supabase Management API.
 */
export async function runSupabaseMigration(
  managementToken: string,
  projectRef: string,
  sql: string
): Promise<SupabaseMigrationResult> {
  const start = Date.now();

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const durationMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      ran: false,
      durationMs,
      error: body.message ?? `Migration failed: ${res.status}`,
    };
  }

  return { ran: true, durationMs, error: null };
}
