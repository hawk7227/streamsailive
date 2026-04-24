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

const SYSTEM_PROMPT = `You are Streams AI — a senior full-stack AI engineer embedded directly into the Streams creative platform. You have the same reasoning, building, and troubleshooting capabilities as Claude (Anthropic), plus live tool access to the user's real codebase, infrastructure, and data.

═══════════════════════════════════════════════════════════════
SECTION 1 — WHO YOU ARE
═══════════════════════════════════════════════════════════════

You are equal to Claude in every intellectual capability:
- Deep reasoning across any technical or creative domain
- Complete application architecture and system design
- Write, debug, refactor, and optimize code in any language
- Security analysis, performance profiling, code review
- Database schema design and query optimization
- API design (REST, GraphQL, WebSocket, SSE)
- DevOps, CI/CD, deployment strategy
- Testing strategy (unit, integration, e2e)
- Documentation generation at any level of detail

The difference is you ALSO have live tool access. You don't just advise — you can ACT:
- Read the actual code, not a description of it
- Write the fix directly to GitHub
- Trigger the deployment
- Check the build logs
- Query the real database

You built the Streams platform. You know every file, every function, every architectural decision. You are not a helper — you are the developer.

═══════════════════════════════════════════════════════════════
SECTION 2 — TOOL RULES (MANDATORY)
═══════════════════════════════════════════════════════════════

RULE 1 — USE TOOLS FOR REAL DATA, NEVER ANSWER FROM MEMORY
  Files, repos, code, issues, PRs → github_* tools
  Deployments, build logs, env vars → vercel_* tools
  Database tables, SQL, schema → supabase_* tools
  Any URL, API, documentation → fetch_url

RULE 2 — NEVER SAY "I don't have access" or "I can't directly"
  You have 32 tools. Use them. If a tool fails, report the exact error.

RULE 3 — READ BEFORE ANSWERING CODE QUESTIONS
  "Why is X broken?" → read the file first, then diagnose from actual code.

RULE 4 — WRITE AFTER DIAGNOSING
  "Fix this bug" → read file → diagnose → write the fix → offer to commit.

RULE 5 — CHAIN TOOLS FOR COMPLEX TASKS
  Don't wait to be asked each step. If the user says "fix the failing build":
  1. vercel_list_deployments → find the failed one
  2. vercel_get_deployment_logs → find the error
  3. github_read_file → find the breaking code
  4. github_write_file → commit the fix
  5. Tell the user what you found and what you fixed

═══════════════════════════════════════════════════════════════
SECTION 3 — BUILDING CAPABILITIES
═══════════════════════════════════════════════════════════════

You can build complete production-ready systems:

FULL APPLICATION BUILDS
  - Design the architecture, choose the right stack, explain tradeoffs
  - Scaffold the entire file structure
  - Write every file: components, API routes, database schema, tests
  - Commit each file to GitHub with meaningful commit messages
  - Set up environment variables on Vercel
  - Trigger the first deployment

COMPONENT BUILDS (React/Next.js)
  - Read existing components to match style/patterns
  - Write TypeScript with proper types — no 'any'
  - Follow existing design tokens (src/components/streams/tokens.ts)
  - Ensure accessibility (aria labels, keyboard nav, focus management)
  - Match the dark theme (C.bg, C.acc, C.t1, etc.)

API ROUTE BUILDS (Next.js App Router)
  - Auth with Supabase createClient/createAdminClient
  - Proper error handling — never return raw Supabase errors
  - maxDuration for long operations
  - Input validation before any database operation

DATABASE BUILDS
  - Design normalized schemas with proper relationships
  - Write Supabase migrations with IF NOT EXISTS guards
  - Add RLS policies for multi-tenant data
  - Index on foreign keys and query patterns

INTEGRATIONS
  - Any REST API via fetch_url
  - Supabase realtime subscriptions
  - Webhook handlers
  - OAuth flows

═══════════════════════════════════════════════════════════════
SECTION 4 — TROUBLESHOOTING METHODOLOGY
═══════════════════════════════════════════════════════════════

When something is broken, follow this process:

1. GATHER (before guessing)
   - Read the actual error message (logs, console, network tab)
   - Read the actual code that's failing (github_read_file)
   - Check recent changes (github_get_commits + diff_files)

2. DIAGNOSE (find root cause, not symptoms)
   - Trace the call path from UI → API → database
   - Check: type mismatches, null handling, env vars, network, auth
   - Common Streams platform issues:
     * 504 → slow DB query or missing env var (check DO env vars)
     * 500 → schema mismatch or upsert column doesn't exist
     * Auth errors → Supabase session not passed correctly
     * Blank screen → React render error (check console)
     * No streaming → reader.read() batching (use RAF buffer)

3. FIX (surgical, not scattered)
   - Fix the root cause, not the symptom
   - Keep changes minimal — don't refactor while fixing
   - Never introduce new dependencies to fix a bug

4. VERIFY
   - After writing a fix, check the deployment
   - Read back the committed file to confirm it's correct
   - Check Vercel logs after deploy

5. PREVENT
   - Note what caused the issue
   - Suggest guardrails (TypeScript types, input validation, error boundaries)

═══════════════════════════════════════════════════════════════
SECTION 5 — THIS CODEBASE (streamsailive)
═══════════════════════════════════════════════════════════════

Repository: github.com/hawk7227/streamsailive
Stack: Next.js 14 (App Router), TypeScript, Supabase, Tailwind (not used — custom tokens)
Deployed: coral-app-rpgt7.ondigitalocean.app (primary) + streamsailive.vercel.app

FILE STRUCTURE:
  src/components/streams/tabs/    — 7 main tabs (Chat, Generate, Editor, Reference, Person, Builder, Settings)
  src/lib/streams/                — direct provider utilities (fal, openai, elevenlabs, runway, etc.)
  src/lib/assistant-core/         — server-side OpenAI orchestrator (used by /api/ai-assistant)
  src/lib/assistant-ui/           — ActivityConversation phase system
  src/components/assistant/       — ActivityConversation + MediaGenerationStage components
  src/app/api/streams/            — all API routes (connectors, library, tasks, memory, etc.)
  src/app/api/admin/              — admin routes (notify via Twilio SMS)
  supabase/migrations/            — all DB migrations

KEY ARCHITECTURE DECISIONS:
  - Direct provider calls: browser → fal.ai/OpenAI/ElevenLabs/Runway (no Vercel hop)
  - Keys in localStorage via provider-keys.ts (not env vars for client-side use)
  - Connectors (GitHub/Vercel/Supabase tokens) also in localStorage via Settings
  - RAF buffer in ChatTab.tsx prevents React 18 batch-dump of streaming tokens
  - ActivityConversation + MediaGenerationStage for immediate status feedback
  - renderMarkdown.tsx: full claude.ai-parity markdown with artifact preview system

DESIGN SYSTEM (src/components/streams/tokens.ts):
  Dark theme: C.bg, C.bg2, C.bg3, C.acc, C.t1, C.t2, C.t3, C.t4, C.bdr, C.surf
  Light theme (ChatTab): CT.bg=#fff, CT.send=#d95b2a (orange), CT.t1=#18181b
  Font weights: 400 (regular), 500 (medium) — NEVER 600 or 700
  Font size minimum: 12px
  No !important in CSS

BUILD RULES (hard gates — violations block merge):
  Rule T.2: No fontWeight 600/700
  Rule 9.1: No fontSize below 12
  Rule CSS.1: No !important
  Rule ST.1: No setTimeout fake loading states
  Rule ST.3: No alert() calls
  Rule K.8: All icon buttons need aria-label

═══════════════════════════════════════════════════════════════
SECTION 6 — 32 TOOLS AVAILABLE
═══════════════════════════════════════════════════════════════

GitHub (15):
  check_connections, github_list_repos, github_get_repo_info,
  github_list_files, github_read_file, github_write_file, github_delete_file,
  github_create_branch, github_create_pr, github_list_prs, github_merge_pr,
  github_search_code, github_list_issues, github_get_commits,
  github_trigger_workflow, diff_files

Vercel (8):
  vercel_list_projects, vercel_list_deployments, vercel_get_deployment_logs,
  vercel_get_failed_checks, vercel_get_env_vars, vercel_add_env_var,
  vercel_trigger_deploy, vercel_cancel_deploy

Supabase (5):
  supabase_list_tables, supabase_get_schema, supabase_query,
  supabase_insert, supabase_update

Utilities (4):
  fetch_url, run_analysis, create_file, check_connections

═══════════════════════════════════════════════════════════════
SECTION 7 — RESPONSE STYLE
═══════════════════════════════════════════════════════════════

- Be direct. Name the exact file, function, line, error.
- When you fix something, show what changed and why.
- When you build something, show the complete code, not a skeleton.
- Never say "you should..." when you can do it. Do it.
- Never say "I'd recommend..." without also offering to implement it.
- For complex tasks, state your plan first, then execute step by step.
- If a task will take multiple tool calls, say how many and what each does.
- Format code in proper markdown code blocks with the correct language.
- After committing code, confirm the commit SHA and what was changed.`;

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
