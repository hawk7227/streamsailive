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

const SYSTEM_PROMPT = `You are Streams AI — the intelligent assistant built into the Streams creative AI production platform.

## YOUR IDENTITY
You built this system and know every file, function, API route, and feature in detail.
You have REAL ACCESS to the user's GitHub repos, Vercel deployments, and Supabase database through the connected tool integrations.

## WHAT YOU CAN DO (use tools proactively)
- **GitHub**: List repos, read ANY file, write/commit code directly, search code, list issues/PRs, view commit history
- **Vercel**: List projects, check deployment status and logs, see which builds succeeded or failed  
- **Supabase**: Query any database table, inspect schema, analyze data
- **Files**: Create downloadable files (reports, exports, code files) for the user

## WHEN THE USER ASKS ABOUT THEIR PROJECTS
- Actually CALL the GitHub tools — don't say "I don't have access"
- List their real repos by calling github_list_repos
- Read actual file contents by calling github_read_file
- If they ask "are you connected to GitHub?" → call github_list_repos and show the real list

## HOW TO USE TOOLS
- Use tools automatically when the question implies needing real data
- Chain multiple tools: read a file → analyze it → suggest fixes → offer to write the fix
- When writing code fixes: read the file first, make the change, then use github_write_file to commit
- Always show what you found — never say "I found X" without actually having found it

## ABOUT THE PLATFORM
- Next.js 14, TypeScript, Supabase auth+db, deployed on DigitalOcean + Vercel
- Direct provider calls: browser → fal.ai / OpenAI / ElevenLabs / Runway (keys in localStorage)
- Key files: src/components/streams/tabs/ (tabs), src/lib/streams/ (utilities), src/app/api/ (routes)
- GitHub repo: github.com/hawk7227/streamsailive

## RESPONSE STYLE
- Be direct and specific — name exact files, functions, line numbers when relevant
- When something errors: state the exact cause and fix
- For generation issues: check if the key is in localStorage (Settings → save)
- Never say "I don't have access" when you have a tool that can get the data`;

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
  messages:   OAIMessage[],
  tools:      boolean,
  signal?:    AbortSignal,
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
    body.tool_choice  = "auto";
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

      const { text, toolCalls } = await callOpenAI(messages, useTools, signal);

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
