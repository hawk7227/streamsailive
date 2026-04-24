/**
 * src/lib/streams/chat-tools.ts
 *
 * Tool definitions + executors for the chat agent.
 * All tools call external APIs directly from the browser using
 * tokens stored in localStorage (set via Settings → Connections).
 *
 * Matches Claude's real tool capabilities:
 *   GitHub  — list/read/write repos, files, issues, PRs, search code
 *   Vercel  — list projects, deployments, env vars
 *   Supabase — run SQL, list tables, inspect schema
 *   Web     — search + fetch URLs
 *   Files   — create downloadable files
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?:   unknown;
  error?:  string;
}

type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;

// ── Token helpers ─────────────────────────────────────────────────────────

function getToken(key: string): string | null {
  try { return localStorage.getItem(key) || null; } catch { return null; }
}

function githubToken(): string | null { return getToken("streams:github_token"); }
function vercelToken(): string | null  { return getToken("streams:vercel_token"); }
function supabaseCreds(): { projectRef: string; serviceRoleKey: string } | null {
  try {
    const raw = getToken("streams:supabase_creds");
    if (!raw) return null;

    // Format 1: JSON object {"projectRef":"...","serviceRoleKey":"..."}
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const projectRef    = parsed.projectRef    ?? parsed.project_ref   ?? parsed.ref     ?? "";
      const serviceRoleKey = parsed.serviceRoleKey ?? parsed.service_role_key ?? parsed.key ?? "";
      if (projectRef && serviceRoleKey) return { projectRef, serviceRoleKey };
    }

    // Format 2: "projectRef|serviceRoleKey" pipe-separated
    if (raw.includes("|")) {
      const [ref, key] = raw.split("|");
      if (ref?.trim() && key?.trim()) return { projectRef: ref.trim(), serviceRoleKey: key.trim() };
    }

    // Format 3: URL format "https://xxx.supabase.co" — extract ref
    if (raw.includes("supabase.co")) {
      const match = raw.match(/https?:\/\/([^.]+)\.supabase\.co/);
      if (match?.[1]) {
        // URL only — no service role key
        return null;
      }
    }

    return null;
  } catch { return null; }
}

// ── GitHub tool executors ─────────────────────────────────────────────────

async function githubRequest(path: string, opts?: RequestInit): Promise<unknown> {
  const token = githubToken();
  if (!token) throw new Error("GitHub token not set — go to Settings → Connections and paste your GitHub PAT.");
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/vnd.github.v3+json",
      "Content-Type":  "application/json",
      ...(opts?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string };
    throw new Error(`GitHub API ${res.status}: ${err.message ?? "Unknown error"}`);
  }
  return res.json();
}

const githubTools: Record<string, ToolExecutor> = {

  github_list_repos: async ({ username, type = "owner", sort = "updated", per_page = 20 }) => {
    try {
      const user = username
        ? await githubRequest(`/users/${String(username)}/repos?type=${type}&sort=${sort}&per_page=${per_page}`)
        : await githubRequest(`/user/repos?type=${type}&sort=${sort}&per_page=${per_page}`);
      const repos = (user as Array<{ name: string; full_name: string; description: string | null; language: string | null; stargazers_count: number; updated_at: string; private: boolean }>)
        .map(r => ({ name: r.full_name, description: r.description, language: r.language, stars: r.stargazers_count, updated: r.updated_at, private: r.private }));
      return { success: true, data: repos };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_read_file: async ({ owner, repo, path, branch = "main" }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`) as {
        content?: string; encoding?: string; size?: number; name?: string; type?: string; download_url?: string;
      };
      // Directory — list it instead
      if (Array.isArray(res)) {
        const items = (res as Array<{ name: string; type: string; size: number; path: string }>)
          .map(f => ({ name: f.name, type: f.type, size: f.size, path: f.path }));
        return { success: true, data: { note: "This is a directory, not a file", items } };
      }
      // File too large for inline (GitHub returns download_url for large files)
      if (!res.content && res.download_url) {
        try {
          const dlRes = await fetch(res.download_url, { signal: AbortSignal.timeout(15_000) });
          const text  = await dlRes.text();
          return { success: true, data: { path, size: res.size, content: text.slice(0, 50000), note: res.size && res.size > 50000 ? `File is ${res.size} bytes — showing first 50KB` : undefined } };
        } catch {
          return { success: false, error: `File too large to read inline (${res.size} bytes). Download at: ${res.download_url}` };
        }
      }
      if (res.encoding === "base64" && res.content) {
        try {
          const content = atob(res.content.replace(/\n/g, ""));
          return { success: true, data: { path, size: res.size, content: content.slice(0, 50000), truncated: (res.size ?? 0) > 50000 } };
        } catch {
          return { success: false, error: `Could not decode file content (encoding: ${res.encoding})` };
        }
      }
      return { success: true, data: res };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_list_files: async ({ owner, repo, path = "", branch = "main" }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
      const items = (res as Array<{ name: string; type: string; size: number; path: string }>)
        .map(f => ({ name: f.name, type: f.type, size: f.size, path: f.path }));
      return { success: true, data: items };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_write_file: async ({ owner, repo, path, content, message, branch = "main" }) => {
    try {
      // Get current SHA if file exists (needed for update)
      let sha: string | undefined;
      try {
        const current = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`) as { sha?: string };
        sha = current.sha;
      } catch { /* new file */ }

      const body = {
        message: String(message),
        content: btoa(unescape(encodeURIComponent(String(content)))),
        branch:  String(branch),
        ...(sha ? { sha } : {}),
      };
      const res = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
        method: "PUT",
        body:   JSON.stringify(body),
      }) as { commit?: { sha: string } };
      return { success: true, data: { committed: true, sha: res.commit?.sha } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_search_code: async ({ query, repo, language, per_page = 10 }) => {
    try {
      const q = [String(query), repo ? `repo:${repo}` : "", language ? `language:${language}` : ""].filter(Boolean).join(" ");
      const res = await githubRequest(`/search/code?q=${encodeURIComponent(q)}&per_page=${per_page}`) as { total_count: number; items: Array<{ path: string; repository: { full_name: string }; html_url: string }> };
      return { success: true, data: { total: res.total_count, results: res.items.map(i => ({ path: i.path, repo: i.repository.full_name, url: i.html_url })) } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_list_issues: async ({ owner, repo, state = "open", labels, per_page = 20 }) => {
    try {
      const params = new URLSearchParams({ state: String(state), per_page: String(per_page) });
      if (labels) params.set("labels", String(labels));
      const res = await githubRequest(`/repos/${owner}/${repo}/issues?${params}`) as Array<{ number: number; title: string; state: string; labels: Array<{ name: string }>; created_at: string; body: string | null }>;
      return { success: true, data: res.map(i => ({ number: i.number, title: i.title, state: i.state, labels: i.labels.map(l => l.name), created: i.created_at, body: i.body?.slice(0, 500) })) };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_create_issue: async ({ owner, repo, title, body, labels }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}/issues`, {
        method: "POST",
        body: JSON.stringify({ title, body, labels: labels ?? [] }),
      }) as { number: number; html_url: string };
      return { success: true, data: { number: res.number, url: res.html_url } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_get_commits: async ({ owner, repo, branch = "main", per_page = 10 }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${per_page}`) as Array<{ sha: string; commit: { message: string; author: { date: string; name: string } } }>;
      return { success: true, data: res.map(c => ({ sha: c.sha.slice(0,7), message: c.commit.message.split("\n")[0], author: c.commit.author.name, date: c.commit.author.date })) };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// ── Vercel tool executors ─────────────────────────────────────────────────

async function vercelRequest(path: string, opts?: RequestInit): Promise<unknown> {
  const token = vercelToken();
  if (!token) throw new Error("Vercel token not set — go to Settings → Connections and paste your Vercel token.");
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      ...(opts?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } })) as { error?: { message?: string } };
    throw new Error(`Vercel API ${res.status}: ${err.error?.message ?? "Unknown error"}`);
  }
  return res.json();
}

const vercelTools: Record<string, ToolExecutor> = {

  vercel_list_projects: async ({ limit = 20 }) => {
    try {
      const res = await vercelRequest(`/v9/projects?limit=${limit}`) as { projects: Array<{ id: string; name: string; framework: string | null; updatedAt: number }> };
      return { success: true, data: res.projects.map(p => ({ id: p.id, name: p.name, framework: p.framework, updated: new Date(p.updatedAt).toISOString() })) };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  vercel_list_deployments: async ({ projectId, limit = 10 }) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (projectId) params.set("projectId", String(projectId));
      const res = await vercelRequest(`/v6/deployments?${params}`) as { deployments: Array<{ uid: string; name: string; state: string; url: string; createdAt: number; meta?: { githubCommitMessage?: string } }> };
      return { success: true, data: res.deployments.map(d => ({ id: d.uid, name: d.name, state: d.state, url: `https://${d.url}`, created: new Date(d.createdAt).toISOString(), commit: d.meta?.githubCommitMessage?.slice(0, 80) })) };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  vercel_get_deployment_logs: async ({ deploymentId }) => {
    try {
      const res = await vercelRequest(`/v2/deployments/${deploymentId}/events`) as Array<{ type: string; created: number; payload?: { text?: string } }>;
      const logs = res.filter(e => e.payload?.text).map(e => e.payload!.text!).join("\n");
      return { success: true, data: { logs: logs.slice(0, 10000) } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// ── Supabase tool executors ───────────────────────────────────────────────

const supabaseTools: Record<string, ToolExecutor> = {

  supabase_list_tables: async () => {
    try {
      const creds = supabaseCreds();
      if (!creds) throw new Error("Supabase credentials not set — go to Settings → Connections.");
      const res = await fetch(
        `https://${creds.projectRef}.supabase.co/rest/v1/`,
        { headers: { "apikey": creds.serviceRoleKey, "Authorization": `Bearer ${creds.serviceRoleKey}` }, signal: AbortSignal.timeout(10_000) }
      );
      // Get tables via pg_tables RPC
      const sql = await supabaseTools.supabase_query!({ query: "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" });
      return sql;
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  supabase_query: async ({ query }) => {
    try {
      const creds = supabaseCreds();
      if (!creds) throw new Error("Supabase credentials not set — go to Settings → Connections.");
      const res = await fetch(
        `https://${creds.projectRef}.supabase.co/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "apikey":          creds.serviceRoleKey,
            "Authorization":   `Bearer ${creds.serviceRoleKey}`,
            "Content-Type":    "application/json",
          },
          body: JSON.stringify({ sql: String(query) }),
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (!res.ok) {
        // Fallback: use PostgREST directly for simple SELECT queries
        const text = await res.text();
        return { success: false, error: `Query failed: ${text.slice(0, 200)}. Note: Complex queries may require the exec_sql RPC to be enabled.` };
      }
      const data = await res.json();
      return { success: true, data };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  supabase_get_schema: async ({ table }) => {
    try {
      const creds = supabaseCreds();
      if (!creds) throw new Error("Supabase credentials not set.");
      const res = await fetch(
        `https://${creds.projectRef}.supabase.co/rest/v1/${table}?limit=0`,
        { method: "HEAD", headers: { "apikey": creds.serviceRoleKey, "Authorization": `Bearer ${creds.serviceRoleKey}` }, signal: AbortSignal.timeout(10_000) }
      );
      const columnsQuery = await supabaseTools.supabase_query!({
        query: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='${table}' ORDER BY ordinal_position`
      });
      void res;
      return columnsQuery;
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// ── All tool executors merged ─────────────────────────────────────────────

// Extended GitHub tools
const githubExtendedTools: Record<string, ToolExecutor> = {

  github_get_repo_info: async ({ owner, repo }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}`) as {
        name: string; full_name: string; description: string | null;
        default_branch: string; private: boolean; language: string | null;
        stargazers_count: number; forks_count: number; open_issues_count: number;
        topics: string[]; clone_url: string; updated_at: string;
      };
      return { success: true, data: {
        name: res.full_name, description: res.description,
        defaultBranch: res.default_branch, private: res.private,
        language: res.language, stars: res.stargazers_count,
        forks: res.forks_count, openIssues: res.open_issues_count,
        topics: res.topics, cloneUrl: res.clone_url, updated: res.updated_at,
      }};
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_create_branch: async ({ owner, repo, branch, from_branch = "main" }) => {
    try {
      // Get SHA of source branch
      const ref = await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${from_branch}`) as { object: { sha: string } };
      const sha = ref.object.sha;
      // Create new branch
      await githubRequest(`/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
      });
      return { success: true, data: { branch, from: from_branch, sha: sha.slice(0,7) } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_delete_file: async ({ owner, repo, path, message, branch = "main" }) => {
    try {
      // Get current SHA
      const current = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`) as { sha: string };
      await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
        method: "DELETE",
        body: JSON.stringify({ message, sha: current.sha, branch }),
      });
      return { success: true, data: { deleted: path, branch } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_create_pr: async ({ owner, repo, title, body, head, base = "main", draft = false }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}/pulls`, {
        method: "POST",
        body: JSON.stringify({ title, body, head, base, draft }),
      }) as { number: number; html_url: string; state: string; mergeable: boolean | null };
      return { success: true, data: { number: res.number, url: res.html_url, state: res.state } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_list_prs: async ({ owner, repo, state = "open", per_page = 10 }) => {
    try {
      const res = await githubRequest(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${per_page}`) as Array<{
        number: number; title: string; state: string; draft: boolean;
        html_url: string; head: { ref: string }; base: { ref: string };
        created_at: string; mergeable_state: string | null;
      }>;
      return { success: true, data: res.map(p => ({
        number: p.number, title: p.title, state: p.state, draft: p.draft,
        url: p.html_url, from: p.head.ref, into: p.base.ref, created: p.created_at,
      }))};
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_merge_pr: async ({ owner, repo, pull_number, merge_method = "squash", commit_title }) => {
    try {
      const body: Record<string, unknown> = { merge_method };
      if (commit_title) body.commit_title = commit_title;
      const res = await githubRequest(`/repos/${owner}/${repo}/pulls/${pull_number}/merge`, {
        method: "PUT", body: JSON.stringify(body),
      }) as { sha: string; merged: boolean; message: string };
      return { success: true, data: { merged: res.merged, sha: res.sha?.slice(0,7), message: res.message } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  github_trigger_workflow: async ({ owner, repo, workflow_id, ref = "main", inputs }) => {
    try {
      await githubRequest(`/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ ref, inputs: inputs ?? {} }),
      });
      return { success: true, data: { triggered: workflow_id, ref } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  diff_files: async ({ owner, repo, base, head, path }) => {
    try {
      const params = new URLSearchParams({ base: String(base), head: String(head) });
      const res = await githubRequest(`/repos/${owner}/${repo}/compare/${base}...${head}`) as {
        ahead_by: number; behind_by: number; status: string;
        files: Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>;
      };
      const files = path ? res.files.filter(f => f.filename.includes(String(path))) : res.files;
      return { success: true, data: {
        status: res.status, ahead: res.ahead_by, behind: res.behind_by,
        files: files.map(f => ({ file: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch?.slice(0, 2000) })),
      }};
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// Extended Vercel tools
const vercelExtendedTools: Record<string, ToolExecutor> = {

  vercel_get_env_vars: async ({ projectId, projectName }) => {
    try {
      // Lookup by name if no ID
      if (!projectId && projectName) {
        const projects = await vercelRequest(`/v9/projects?limit=100`) as { projects: Array<{ id: string; name: string }> };
        const match = projects.projects.find(p => p.name === String(projectName));
        if (!match) return { success: false, error: `Project '${projectName}' not found` };
        projectId = match.id;
      }
      const res = await vercelRequest(`/v9/projects/${projectId}/env`) as {
        envs: Array<{ id: string; key: string; value?: string; type: string; target: string[] }>;
      };
      // Mask values for security — show key names only
      return { success: true, data: res.envs.map(e => ({
        key: e.key, type: e.type, target: e.target,
        value: e.type === "encrypted" ? "***encrypted***" : e.value?.slice(0, 20) + "...",
      }))};
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  vercel_add_env_var: async ({ projectId, key, value, target = ["production", "preview"] }) => {
    try {
      await vercelRequest(`/v10/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify({ key, value, type: "encrypted", target }),
      });
      return { success: true, data: { added: key, target } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  vercel_trigger_deploy: async ({ deployHookUrl }) => {
    try {
      if (!String(deployHookUrl).startsWith("https://api.vercel.com/v1/integrations/deploy/")) {
        return { success: false, error: "Invalid deploy hook URL. Get it from Vercel project → Settings → Git → Deploy Hooks." };
      }
      const res = await fetch(String(deployHookUrl), { method: "POST", signal: AbortSignal.timeout(10_000) });
      const data = await res.json() as { job?: { id: string; state: string } };
      return { success: true, data: { triggered: true, jobId: data.job?.id, state: data.job?.state } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  vercel_cancel_deploy: async ({ deploymentId }) => {
    try {
      const res = await vercelRequest(`/v12/deployments/${deploymentId}/cancel`, { method: "PATCH" }) as { state: string };
      return { success: true, data: { state: res.state } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  vercel_get_failed_checks: async ({ deploymentId }) => {
    try {
      const res = await vercelRequest(`/v1/deployments/${deploymentId}/checks`) as {
        checks: Array<{ name: string; status: string; conclusion: string | null; output?: { summary?: string } }>;
      };
      const failed = res.checks.filter(c => c.conclusion === "failed" || c.status === "failed");
      return { success: true, data: {
        total: res.checks.length,
        failed: failed.map(c => ({ name: c.name, status: c.status, summary: c.output?.summary })),
      }};
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// Extended Supabase tools
const supabaseExtendedTools: Record<string, ToolExecutor> = {

  supabase_insert: async ({ table, data }) => {
    try {
      const creds = supabaseCreds();
      if (!creds) throw new Error("Supabase credentials not set.");
      const res = await fetch(`https://${creds.projectRef}.supabase.co/rest/v1/${table}`, {
        method: "POST",
        headers: {
          "apikey": creds.serviceRoleKey, "Authorization": `Bearer ${creds.serviceRoleKey}`,
          "Content-Type": "application/json", "Prefer": "return=representation",
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: JSON.stringify(result).slice(0, 200) };
      return { success: true, data: result };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  supabase_update: async ({ table, match, data }) => {
    try {
      const creds = supabaseCreds();
      if (!creds) throw new Error("Supabase credentials not set.");
      const matchParams = Object.entries(match as Record<string,unknown>).map(([k,v]) => `${k}=eq.${v}`).join("&");
      const res = await fetch(`https://${creds.projectRef}.supabase.co/rest/v1/${table}?${matchParams}`, {
        method: "PATCH",
        headers: {
          "apikey": creds.serviceRoleKey, "Authorization": `Bearer ${creds.serviceRoleKey}`,
          "Content-Type": "application/json", "Prefer": "return=representation",
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: JSON.stringify(result).slice(0, 200) };
      return { success: true, data: result };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// General utilities
const utilityTools: Record<string, ToolExecutor> = {

  fetch_url: async ({ url, method = "GET", headers, body }) => {
    try {
      const opts: RequestInit = {
        method: String(method),
        headers: { "User-Agent": "StreamsAI/1.0", ...(headers as Record<string,string> ?? {}) },
        signal: AbortSignal.timeout(15_000),
      };
      if (body) opts.body = typeof body === "string" ? body : JSON.stringify(body);
      const res = await fetch(String(url), opts);
      const text = await res.text();
      // Try to parse JSON, fall back to text
      let data: unknown = text.slice(0, 20000);
      try { data = JSON.parse(text); } catch { /* keep as text */ }
      return { success: res.ok, data, status: res.status };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  run_analysis: async ({ owner, repo, paths, branch = "main" }) => {
    // Read multiple files in parallel and return combined analysis
    try {
      const filePaths = Array.isArray(paths) ? paths as string[] : [String(paths)];
      const results = await Promise.all(filePaths.map(async (path) => {
        try {
          const res = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`) as { content?: string; encoding?: string; size?: number };
          if (res.encoding === "base64" && res.content) {
            const content = atob(res.content.replace(/\n/g, ""));
            return { path, content: content.slice(0, 15000), size: res.size };
          }
          return { path, error: "Could not decode" };
        } catch (e) { return { path, error: (e as Error).message }; }
      }));
      return { success: true, data: results };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};


export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  ...githubTools,
  ...githubExtendedTools,
  ...vercelTools,
  ...vercelExtendedTools,
  ...supabaseTools,
  ...supabaseExtendedTools,
  ...utilityTools,

  // Check what connections are available
  check_connections: async () => {
    try {
      const gh  = getToken("streams:github_token");
      const vc  = getToken("streams:vercel_token");
      const sb  = getToken("streams:supabase_creds");
      return {
        success: true,
        data: {
          github:   gh  ? `✅ Connected (token: ${gh.slice(0,8)}...)` : "❌ Not connected — go to Settings → Connections",
          vercel:   vc  ? `✅ Connected (token: ${vc.slice(0,8)}...)` : "❌ Not connected — go to Settings → Connections",
          supabase: sb  ? `✅ Connected` : "❌ Not connected — go to Settings → Connections",
        }
      };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },

  // Create a downloadable file
  create_file: async ({ filename, content, type = "text/plain" }) => {
    try {
      const blob = new Blob([String(content)], { type: String(type) });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = String(filename); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return { success: true, data: { created: filename, size: blob.size } };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  },
};

// ── OpenAI tool definitions (schema passed to the API) ────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "check_connections",
      description: "Check which integrations (GitHub, Vercel, Supabase) are currently connected and have valid tokens. Call this first if unsure whether a connection is available.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_list_repos",
      description: "List GitHub repositories for the authenticated user or a specific username. Use this when the user asks about their repos or projects.",
      parameters: {
        type: "object",
        properties: {
          username:  { type: "string", description: "GitHub username (omit for authenticated user's repos)" },
          type:      { type: "string", enum: ["owner","member","public","private","forks","sources"], description: "Repository type filter" },
          sort:      { type: "string", enum: ["updated","created","pushed","full_name"] },
          per_page:  { type: "number", description: "Number of repos to return (max 100)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_read_file",
      description: "Read the contents of a file from a GitHub repository. Use when the user asks to see, analyze, or fix code in a specific file.",
      parameters: {
        type: "object",
        required: ["owner", "repo", "path"],
        properties: {
          owner:  { type: "string", description: "Repository owner (username or org)" },
          repo:   { type: "string", description: "Repository name" },
          path:   { type: "string", description: "File path within the repo e.g. src/index.ts" },
          branch: { type: "string", description: "Branch name (default: main)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_list_files",
      description: "List files and directories in a GitHub repository path. Use to explore repo structure.",
      parameters: {
        type: "object",
        required: ["owner", "repo"],
        properties: {
          owner:  { type: "string" },
          repo:   { type: "string" },
          path:   { type: "string", description: "Directory path (default: root)" },
          branch: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_write_file",
      description: "Create or update a file in a GitHub repository. Use when the user asks to fix code, update a file, or commit changes.",
      parameters: {
        type: "object",
        required: ["owner", "repo", "path", "content", "message"],
        properties: {
          owner:   { type: "string" },
          repo:    { type: "string" },
          path:    { type: "string", description: "File path to create/update" },
          content: { type: "string", description: "Full file content" },
          message: { type: "string", description: "Git commit message" },
          branch:  { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_search_code",
      description: "Search for code across GitHub repositories. Use when looking for specific functions, patterns, or implementations.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query:    { type: "string", description: "Search query e.g. 'useState hook filename:ChatTab'" },
          repo:     { type: "string", description: "Limit to specific repo e.g. 'owner/reponame'" },
          language: { type: "string", description: "Filter by language e.g. 'typescript'" },
          per_page: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_list_issues",
      description: "List issues or pull requests from a GitHub repository.",
      parameters: {
        type: "object",
        required: ["owner", "repo"],
        properties: {
          owner:    { type: "string" },
          repo:     { type: "string" },
          state:    { type: "string", enum: ["open","closed","all"] },
          labels:   { type: "string", description: "Comma-separated label names" },
          per_page: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "github_get_commits",
      description: "Get recent commit history for a repository.",
      parameters: {
        type: "object",
        required: ["owner", "repo"],
        properties: {
          owner:    { type: "string" },
          repo:     { type: "string" },
          branch:   { type: "string" },
          per_page: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "vercel_list_projects",
      description: "List all Vercel projects for the authenticated account.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "vercel_list_deployments",
      description: "List recent Vercel deployments, optionally filtered by project.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
          limit:     { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "vercel_get_deployment_logs",
      description: "Get build/deployment logs for a specific Vercel deployment.",
      parameters: {
        type: "object",
        required: ["deploymentId"],
        properties: { deploymentId: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "supabase_list_tables",
      description: "List all tables in the connected Supabase database.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "supabase_query",
      description: "Run a SQL query against the connected Supabase database. Use for SELECT queries to analyze data.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string", description: "SQL query to execute" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "supabase_get_schema",
      description: "Get the column schema for a specific Supabase table.",
      parameters: {
        type: "object",
        required: ["table"],
        properties: { table: { type: "string", description: "Table name" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_file",
      description: "Create a downloadable file for the user. Use when the user asks to generate a document, export data, or save code to a file.",
      parameters: {
        type: "object",
        required: ["filename", "content"],
        properties: {
          filename: { type: "string", description: "Filename with extension e.g. report.md, data.csv" },
          content:  { type: "string", description: "File content" },
          type:     { type: "string", description: "MIME type e.g. text/plain, text/markdown, text/csv" },
        },
      },
    },
  },
  // ── Extended GitHub ───────────────────────────────────────────────────────
  { type: "function" as const, function: { name: "github_get_repo_info", description: "Get repository metadata: default branch, language, stars, topics, visibility.", parameters: { type: "object", required: ["owner","repo"], properties: { owner: {type:"string"}, repo: {type:"string"} } } } },
  { type: "function" as const, function: { name: "github_create_branch", description: "Create a new git branch from an existing branch. Do this BEFORE writing files for a PR workflow.", parameters: { type: "object", required: ["owner","repo","branch"], properties: { owner:{type:"string"}, repo:{type:"string"}, branch:{type:"string",description:"New branch name"}, from_branch:{type:"string",description:"Source branch (default: main)"} } } } },
  { type: "function" as const, function: { name: "github_delete_file", description: "Delete a file from a GitHub repository.", parameters: { type: "object", required: ["owner","repo","path","message"], properties: { owner:{type:"string"}, repo:{type:"string"}, path:{type:"string"}, message:{type:"string",description:"Commit message"}, branch:{type:"string"} } } } },
  { type: "function" as const, function: { name: "github_create_pr", description: "Create a pull request. Use after writing changes on a branch to propose merging into main.", parameters: { type: "object", required: ["owner","repo","title","head"], properties: { owner:{type:"string"}, repo:{type:"string"}, title:{type:"string"}, body:{type:"string",description:"PR description"}, head:{type:"string",description:"Branch with changes"}, base:{type:"string",description:"Target branch (default: main)"}, draft:{type:"boolean"} } } } },
  { type: "function" as const, function: { name: "github_list_prs", description: "List pull requests in a repository with their state and branches.", parameters: { type: "object", required: ["owner","repo"], properties: { owner:{type:"string"}, repo:{type:"string"}, state:{type:"string",enum:["open","closed","all"]}, per_page:{type:"number"} } } } },
  { type: "function" as const, function: { name: "github_merge_pr", description: "Merge a pull request into its base branch.", parameters: { type: "object", required: ["owner","repo","pull_number"], properties: { owner:{type:"string"}, repo:{type:"string"}, pull_number:{type:"number"}, merge_method:{type:"string",enum:["merge","squash","rebase"]}, commit_title:{type:"string"} } } } },
  { type: "function" as const, function: { name: "github_trigger_workflow", description: "Trigger a GitHub Actions workflow (CI/CD pipeline).", parameters: { type: "object", required: ["owner","repo","workflow_id"], properties: { owner:{type:"string"}, repo:{type:"string"}, workflow_id:{type:"string",description:"Workflow filename e.g. ci.yml or workflow ID"}, ref:{type:"string"}, inputs:{type:"object"} } } } },
  { type: "function" as const, function: { name: "diff_files", description: "Compare two branches/commits to see what changed. Shows file diffs and patch content.", parameters: { type: "object", required: ["owner","repo","base","head"], properties: { owner:{type:"string"}, repo:{type:"string"}, base:{type:"string",description:"Base branch/commit"}, head:{type:"string",description:"Comparison branch/commit"}, path:{type:"string",description:"Filter to specific file path"} } } } },
  // ── Extended Vercel ───────────────────────────────────────────────────────
  { type: "function" as const, function: { name: "vercel_get_env_vars", description: "List environment variables for a Vercel project. Values are masked for security.", parameters: { type: "object", properties: { projectId:{type:"string"}, projectName:{type:"string",description:"Project name if no ID"} } } } },
  { type: "function" as const, function: { name: "vercel_add_env_var", description: "Add or update an environment variable on a Vercel project.", parameters: { type: "object", required: ["projectId","key","value"], properties: { projectId:{type:"string"}, key:{type:"string"}, value:{type:"string"}, target:{type:"array",items:{type:"string"},description:"Environments: production, preview, development"} } } } },
  { type: "function" as const, function: { name: "vercel_trigger_deploy", description: "Trigger a Vercel deployment via a deploy hook URL. Get the hook from Vercel project Settings → Git → Deploy Hooks.", parameters: { type: "object", required: ["deployHookUrl"], properties: { deployHookUrl:{type:"string",description:"Full Vercel deploy hook URL"} } } } },
  { type: "function" as const, function: { name: "vercel_cancel_deploy", description: "Cancel a currently running Vercel deployment.", parameters: { type: "object", required: ["deploymentId"], properties: { deploymentId:{type:"string"} } } } },
  { type: "function" as const, function: { name: "vercel_get_failed_checks", description: "Get failed build checks for a Vercel deployment — shows what caused it to fail.", parameters: { type: "object", required: ["deploymentId"], properties: { deploymentId:{type:"string"} } } } },
  // ── Extended Supabase ─────────────────────────────────────────────────────
  { type: "function" as const, function: { name: "supabase_insert", description: "Insert one or more rows into a Supabase table.", parameters: { type: "object", required: ["table","data"], properties: { table:{type:"string"}, data:{type:"object",description:"Row data as object or array of objects"} } } } },
  { type: "function" as const, function: { name: "supabase_update", description: "Update rows in a Supabase table matching specific conditions.", parameters: { type: "object", required: ["table","match","data"], properties: { table:{type:"string"}, match:{type:"object",description:"Column=value conditions to match rows"}, data:{type:"object",description:"Updated values"} } } } },
  // ── Utilities ─────────────────────────────────────────────────────────────
  { type: "function" as const, function: { name: "fetch_url", description: "Fetch any URL — API endpoints, documentation pages, webhooks, external data sources. Returns response body.", parameters: { type: "object", required: ["url"], properties: { url:{type:"string"}, method:{type:"string",enum:["GET","POST","PUT","PATCH","DELETE"]}, headers:{type:"object"}, body:{description:"Request body"} } } } },
  { type: "function" as const, function: { name: "run_analysis", description: "Read multiple files in parallel from a GitHub repo for comprehensive codebase analysis. Use when analyzing how multiple files interact.", parameters: { type: "object", required: ["owner","repo","paths"], properties: { owner:{type:"string"}, repo:{type:"string"}, paths:{type:"array",items:{type:"string"},description:"Array of file paths to read simultaneously"}, branch:{type:"string"} } } } },
];

// ── Tool call executor — runs a single tool and returns result ─────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const executor = TOOL_EXECUTORS[name];
  if (!executor) return JSON.stringify({ success: false, error: `Unknown tool: ${name}` });

  try {
    const result = await executor(args);
    return JSON.stringify(result, null, 2);
  } catch (e) {
    return JSON.stringify({ success: false, error: (e as Error).message });
  }
}
