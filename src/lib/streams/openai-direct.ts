/**
 * src/lib/streams/openai-direct.ts
 *
 * Direct browser → OpenAI with full tool-calling agent loop.
 * Reads the OpenAI key from localStorage (set by SettingsTab on save).
 *
 * Agent loop:
 *   1. Send message + tool definitions to OpenAI
 *   2. If response has tool_calls → execute each tool (GitHub/Vercel/Supabase/etc.)
 *   3. Send tool results back → continue until text response
 *   4. Stream final text response via RAF buffer
 */

import { getProviderKey } from "./provider-keys";
import { TOOL_DEFINITIONS, executeTool } from "./chat-tools";

export type StreamChunkHandler   = (delta: string) => void;
export type StreamDoneHandler    = () => void;
export type StreamErrorHandler   = (err: string) => void;
export type ToolCallHandler      = (name: string, status: "running"|"done"|"error", result?: string) => void;

export interface DirectStreamOptions {
  message:       string;
  history?:      Array<{ role: "user" | "assistant"; content: string }>;
  onDelta:       StreamChunkHandler;
  onDone:        StreamDoneHandler;
  onError:       StreamErrorHandler;
  onToolCall?:   ToolCallHandler;   // called when a tool runs
  signal?:       AbortSignal;
  enableTools?:  boolean;           // default true
}

const SYSTEM_PROMPT = `You are Streams AI — a fully connected AI assistant with LIVE ACCESS to the user's GitHub, Vercel, and Supabase accounts via function tools.

## MANDATORY TOOL RULES — NEVER VIOLATE THESE

**RULE 1: ALWAYS CALL TOOLS FOR REAL DATA. NEVER ANSWER FROM MEMORY.**
If the user asks about ANY of these → you MUST call the relevant tool, not describe from memory:
- Files, repos, code, commits, branches, issues, PRs → call github_* tools
- Deployments, projects, build logs, env vars → call vercel_* tools  
- Database tables, SQL queries, schemas → call supabase_* tools
- "What files do you have access to?" → call github_list_repos AND github_list_files
- "List the project files" → call github_list_files on the streamsailive repo
- "Are you connected to GitHub?" → prove it by calling github_list_repos and showing REAL results

**RULE 2: DO NOT SAY "I don't have access" OR "I can't directly"**
You have tools. Use them. If a tool fails, report the actual error.

**RULE 3: READ BEFORE ANSWERING CODE QUESTIONS**
If asked about specific code → call github_read_file first, THEN answer based on actual content.

**RULE 4: OFFER TO WRITE CHANGES**
After reading a file and suggesting a fix → offer to github_write_file the fix directly.

## ABOUT THIS PLATFORM
- Repo: github.com/hawk7227/streamsailive (Next.js 14, TypeScript)
- Key dirs: src/components/streams/tabs/, src/lib/streams/, src/app/api/streams/
- Deployed: coral-app-rpgt7.ondigitalocean.app (DigitalOcean) + streamsailive.vercel.app
- Direct provider calls: browser → fal.ai/OpenAI/ElevenLabs/Runway via localStorage keys

## TOOL REFERENCE — 32 TOOLS AVAILABLE

**GitHub (14 tools):**
- github_list_repos        → all repos with language/stars
- github_get_repo_info     → default branch, topics, visibility
- github_list_files        → directory listing
- github_read_file         → full file content (up to 50KB)
- github_write_file        → commit a file (create or update)
- github_delete_file       → remove a file from repo
- github_create_branch     → new branch from existing (do this BEFORE write for PR workflow)
- github_create_pr         → open pull request (head → base)
- github_list_prs          → list open/closed PRs
- github_merge_pr          → merge a PR (squash/merge/rebase)
- github_search_code       → search across repos by query/language
- github_list_issues       → list issues with labels
- github_get_commits       → recent commit history
- github_trigger_workflow  → trigger GitHub Actions CI/CD
- diff_files               → compare branches/commits (shows patch)

**Vercel (7 tools):**
- vercel_list_projects      → all projects with framework
- vercel_list_deployments   → recent deployments with state/url/commit
- vercel_get_deployment_logs → build logs (find errors)
- vercel_get_failed_checks  → what checks failed and why
- vercel_get_env_vars       → list env vars (values masked)
- vercel_add_env_var        → add/update an env var
- vercel_trigger_deploy     → redeploy via hook URL
- vercel_cancel_deploy      → cancel stuck deployment

**Supabase (5 tools):**
- supabase_list_tables → all public tables
- supabase_get_schema  → columns/types for a table
- supabase_query       → run SQL (SELECT/INSERT/UPDATE)
- supabase_insert      → insert rows via REST API
- supabase_update      → update rows matching conditions

**Utilities (4 tools):**
- check_connections → verify GitHub/Vercel/Supabase token status
- fetch_url        → GET/POST any URL (APIs, docs, webhooks)
- run_analysis     → read multiple files in parallel
- create_file      → generate a downloadable file

## DEVELOPER WORKFLOWS

**Full PR workflow:**
1. github_create_branch (new-fix-branch from main)
2. github_write_file (make the change)
3. github_create_pr (open PR from branch → main)
4. github_merge_pr (after review)

**Debug failed Vercel build:**
1. vercel_list_deployments (find the failed one)
2. vercel_get_deployment_logs (read build output)
3. vercel_get_failed_checks (specific checks that failed)
4. github_read_file (find the breaking code)
5. github_write_file (fix it)

**Database operations:**
- SELECT: supabase_query with SQL
- INSERT: supabase_insert with table + data object
- UPDATE: supabase_update with match conditions + new data`;

// ── Detect if query needs tools (forces tool call instead of relying on model) ──
function requiresTools(message: string): boolean {
  const lower = message.toLowerCase();
  return /file|repo|project|commit|branch|code|issue|pr|pull request|deploy|build|log|table|database|sql|query|schema|write|fix|update|create/.test(lower)
    || /list|show|read|find|search|check|access|connect/.test(lower);
}

// ── Message types ─────────────────────────────────────────────────────────

type OAIMessage =
  | { role: "system";    content: string }
  | { role: "user";      content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OAIToolCall[] }
  | { role: "tool";      content: string; tool_call_id: string };

interface OAIToolCall {
  id:       string;
  type:     "function";
  function: { name: string; arguments: string };
}

interface OAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?:     string | null;
      tool_calls?:  Array<{
        index:    number;
        id?:      string;
        type?:    "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
}

// ── Core streaming call ───────────────────────────────────────────────────

async function callOpenAI(
  messages:    OAIMessage[],
  tools:       boolean,
  signal?:     AbortSignal,
  forceTools?: boolean,   // true on first call when query clearly needs tools
): Promise<{ text: string; toolCalls: OAIToolCall[] }> {
  const apiKey = getProviderKey("openai");
  if (!apiKey) throw new Error("OpenAI key not set — go to Settings → API Keys, paste your OpenAI key, then Save.");

  const body: Record<string, unknown> = {
    model:       "gpt-4o",
    messages,
    stream:      true,
    max_tokens:  4096,
    temperature: 0.7,
  };

  if (tools) {
    body.tools        = TOOL_DEFINITIONS;
    // Force tool use on first call when query clearly needs live data
    body.tool_choice  = forceTools ? "required" : "auto";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body:    JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    if (res.status === 401) throw new Error("OpenAI key is invalid or expired — go to Settings and re-enter your OpenAI key.");
    if (res.status === 429) throw new Error("OpenAI rate limit — wait 30 seconds and try again.");
    if (res.status === 402) throw new Error("OpenAI billing issue — check your OpenAI account has credits at platform.openai.com/billing.");
    throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 200)}`);
  }
  if (!res.body) throw new Error("No response body from OpenAI.");

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";
  let text      = "";

  // Accumulate tool calls across streaming chunks
  const toolCallAccum: Record<number, { id: string; name: string; args: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;
      try {
        const chunk = JSON.parse(trimmed.slice(6)) as OAIStreamChunk;
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) text += delta.content;
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccum[tc.index]) {
              toolCallAccum[tc.index] = { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" };
            }
            if (tc.id)              toolCallAccum[tc.index].id   = tc.id;
            if (tc.function?.name)  toolCallAccum[tc.index].name = tc.function.name;
            if (tc.function?.arguments) toolCallAccum[tc.index].args += tc.function.arguments;
          }
        }
      } catch { /* malformed chunk */ }
    }
  }

  const toolCalls: OAIToolCall[] = Object.values(toolCallAccum).map(tc => ({
    id:       tc.id,
    type:     "function" as const,
    function: { name: tc.name, arguments: tc.args },
  }));

  return { text, toolCalls };
}

// ── Public streaming function with agent loop ────────────────────────────

export async function streamDirectFromOpenAI(opts: DirectStreamOptions): Promise<void> {
  const { message, history, onDelta, onDone, onError, onToolCall, signal } = opts;
  const useTools = opts.enableTools !== false;

  const messages: OAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(history ?? []).map(m => ({ role: m.role, content: m.content })) as OAIMessage[],
    { role: "user", content: message },
  ];

  try {
    let iterations = 0;
    const MAX_ITERATIONS = 8; // prevent infinite loops

    while (iterations < MAX_ITERATIONS) {
      if (signal?.aborted) return;
      iterations++;

      // First call: force tools if query clearly needs live data
      const forceTools = iterations === 1 && useTools && requiresTools(message);
      const { text, toolCalls } = await callOpenAI(messages, useTools, signal, forceTools);

      if (toolCalls.length === 0) {
        // Final text response — stream it delta by delta
        for (const char of text) {
          if (signal?.aborted) return;
          onDelta(char);
          // Yield every 4 chars to allow RAF to drain
          if (text.indexOf(char) % 4 === 0) await Promise.resolve();
        }
        onDone();
        return;
      }

      // Has tool calls — execute them
      messages.push({
        role:       "assistant",
        content:    text || null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        if (signal?.aborted) return;
        const fnName = tc.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* invalid JSON */ }

        onToolCall?.(fnName, "running");

        const result = await executeTool(fnName, args);
        const parsed = JSON.parse(result) as { success: boolean };
        onToolCall?.(fnName, parsed.success ? "done" : "error", result);

        messages.push({
          role:         "tool",
          content:      result,
          tool_call_id: tc.id,
        });
      }
      // Loop back — let OpenAI process tool results and either respond or call more tools
    }

    onError("Agent loop exceeded max iterations — the task may be too complex. Try breaking it into smaller steps.");
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted")))) return;
    onError(err instanceof Error ? err.message : "Connection to OpenAI failed.");
  }
}
