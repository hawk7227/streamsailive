/**
 * src/lib/streams/connectors/vercel.ts
 *
 * Vercel connector adapter — Phase 7.
 *
 * Uses Vercel API token stored encrypted.
 * Token is decrypted server-side only.
 *
 * Actions:
 *   validateToken()       — verify token, return user + teams
 *   getDeployments()      — recent deployments for a project
 *   getDeploymentStatus() — status of a specific deployment
 *   getLatestDeployment() — most recent deployment + its status
 *   cancelDeployment()    — cancel an in-progress deploy (destructive)
 */

const VERCEL_API = "https://api.vercel.com";

export interface VercelValidation {
  valid:    boolean;
  username: string | null;
  email:    string | null;
  error?:   string;
}

export interface VercelDeployment {
  uid:        string;
  url:        string;
  state:      string;
  // 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED'
  target:     string | null;
  // 'production' | 'preview' | null
  meta:       Record<string, string>;
  createdAt:  number;
  buildingAt: number | null;
  ready:      number | null;
  projectId:  string;
  commit?:    string;
  branch?:    string;
}

// ── Headers ───────────────────────────────────────────────────────────────────

function headers(token: string): Record<string, string> {
  return {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ── Validate token ────────────────────────────────────────────────────────────

export async function validateVercelToken(token: string): Promise<VercelValidation> {
  try {
    const res = await fetch(`${VERCEL_API}/v2/user`, {
      headers: headers(token),
    });

    if (!res.ok) {
      return { valid: false, username: null, email: null, error: `HTTP ${res.status}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const user = data.user as Record<string, unknown>;

    return {
      valid:    true,
      username: user?.username as string | null,
      email:    user?.email as string | null,
    };
  } catch (err) {
    return {
      valid:    false,
      username: null,
      email:    null,
      error:    err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Get deployments ───────────────────────────────────────────────────────────

export async function getVercelDeployments(
  token: string,
  projectIdOrSlug: string,
  limit = 5,
): Promise<VercelDeployment[]> {
  const url = `${VERCEL_API}/v6/deployments?projectId=${encodeURIComponent(projectIdOrSlug)}&limit=${limit}`;

  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return [];

  const data = await res.json() as Record<string, unknown>;
  const deployments = (data.deployments as Record<string, unknown>[]) ?? [];

  return deployments.map(d => ({
    uid:        d.uid as string,
    url:        `https://${d.url as string}`,
    state:      d.state as string,
    target:     d.target as string | null,
    meta:       (d.meta as Record<string, string>) ?? {},
    createdAt:  d.createdAt as number,
    buildingAt: d.buildingAt as number | null,
    ready:      d.ready as number | null,
    projectId:  d.projectId as string,
    commit:     (d.meta as Record<string, string>)?.githubCommitSha,
    branch:     (d.meta as Record<string, string>)?.githubCommitRef,
  }));
}

// ── Get specific deployment status ────────────────────────────────────────────

export async function getVercelDeploymentStatus(
  token: string,
  deploymentId: string,
): Promise<{ state: string; url: string; readyAt: number | null } | null> {
  const res = await fetch(
    `${VERCEL_API}/v13/deployments/${deploymentId}`,
    { headers: headers(token) }
  );

  if (!res.ok) return null;

  const data = await res.json() as Record<string, unknown>;
  return {
    state:   data.status as string,
    url:     `https://${data.url as string}`,
    readyAt: data.ready as number | null,
  };
}

// ── Get latest deployment ─────────────────────────────────────────────────────

export async function getLatestVercelDeployment(
  token: string,
  projectIdOrSlug: string,
): Promise<VercelDeployment | null> {
  const deployments = await getVercelDeployments(token, projectIdOrSlug, 1);
  return deployments[0] ?? null;
}

// ── Cancel deployment (destructive — caller must log) ─────────────────────────

export async function cancelVercelDeployment(
  token: string,
  deploymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `${VERCEL_API}/v12/deployments/${deploymentId}/cancel`,
    {
      method:  "PATCH",
      headers: headers(token),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { success: false, error: err.error as string ?? `HTTP ${res.status}` };
  }

  return { success: true };
}

// ── Poll until ready (used by runtime workflow) ────────────────────────────────

export async function pollVercelDeployment(
  token: string,
  deploymentId: string,
  maxWaitMs = 300_000,
  intervalMs = 5_000,
): Promise<{ state: string; url: string }> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const status = await getVercelDeploymentStatus(token, deploymentId);
    if (!status) break;

    if (status.state === "READY" || status.state === "ERROR" || status.state === "CANCELED") {
      return { state: status.state, url: status.url };
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { state: "TIMEOUT", url: "" };
}
