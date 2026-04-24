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
    return JSON.parse(raw) as { projectRef: string; serviceRoleKey: string };
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
      const res = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`) as { content?: string; encoding?: string; size?: number; name?: string };
      if (res.encoding === "base64" && res.content) {
        const content = atob(res.content.replace(/\n/g, ""));
        return { success: true, data: { path, size: res.size, content: content.slice(0, 50000) } };
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

export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  ...githubTools,
  ...vercelTools,
  ...supabaseTools,

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
