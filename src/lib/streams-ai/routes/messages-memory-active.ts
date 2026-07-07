import { type NextRequest } from "next/server";
import { requireStreamsAIScope, type StreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { learnFromStreamsTurn, retrieveStreamsMemoryContext, type StreamsMemoryContext } from "../intelligence/memory-engine";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import { buildAttachmentContext, buildUserMetadata, ensureSession, getHistoryForPrompt, persistChatTurn } from "./messages-memory-provider-support";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const SOURCE = "streams-ai-openai-responses-live";
const MAX_HISTORY_MESSAGES = 16;
const MEMORY_RETRIEVAL_TIMEOUT_MS = 350;

type Body = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type Send = (event: string, payload: Record<string, unknown>) => void;
type ProviderResult = { content: string; provider: "openai"; model: string; providerStatus: "ok"; webGrounded: true; providerRoute: "openai-responses"; ungroundedFallbackUsed: false };

function sse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function chunks(text: string, size = 180) {
  const value = String(text || "");
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out;
}

function duration(ms: number) {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}

function emptyMemory(query: string): StreamsMemoryContext {
  return { memories: [], promptBlock: "", retrieval: { source: "streams-memory", query, memoryCount: 0, scopes: [], strategy: ["empty"] } };
}

function timeoutMemory(query: string): StreamsMemoryContext {
  return { memories: [], promptBlock: "", retrieval: { source: "streams-memory", query, memoryCount: 0, scopes: [], strategy: ["timeout", `${MEMORY_RETRIEVAL_TIMEOUT_MS}ms`] } };
}

async function retrieveMemoryWithTimeout(scope: StreamsAIScope, userContent: string, limit = 12) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      retrieveStreamsMemoryContext(scope, { userContent, limit }),
      new Promise<StreamsMemoryContext>((resolve) => { timer = setTimeout(() => resolve(timeoutMemory(userContent)), MEMORY_RETRIEVAL_TIMEOUT_MS); }),
    ]);
  } catch {
    return emptyMemory(userContent);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function rememberTurn(scope: StreamsAIScope, input: { sessionId: string; userContent: string; assistantContent: string; sourceMessageId?: string | null; provider?: string; providerStatus?: string; metadata?: Record<string, unknown> }) {
  void learnFromStreamsTurn(scope, input).catch(() => null);
}

function systemPrompt(scope: StreamsAIScope) {
  const first = String(scope.userFirstName || "").trim();
  return [
    "You are a general-purpose AI assistant running inside StreamsAI.",
    "StreamsAI is a general ChatGPT/Claude-style AI assistant platform with chat, uploads, files, writing, research, generation, coding, tools, workspaces, saved projects, and project flow.",
    "StreamsAI helps users turn conversations into completed work.",
    "Use StreamsAI context when the user asks about StreamsAI. Otherwise answer normally as a general assistant.",
    "Answer directly, be practical, and complete the user's task whenever possible.",
    "For implementation work, include exact files, functions, routes, commits, current status, likely cause, fix, and verification steps when evidence is available.",
    "For launch, positioning, or product strategy, keep StreamsAI positioned as a general AI assistant workspace.",
    "Never claim testing, deployment, repo changes, web research, tool execution, or runtime verification unless it actually happened.",
    first ? `The signed-in account holder's first name is ${first}. Use it only when naturally helpful.` : "No reliable first name is available. Do not invent one.",
  ].join("\n");
}

export async function memoryMessagesGET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    const session = await sessions.get(scope, sessionId);
    if (!session) return streamsAIJson({ ok: true, messages: [], missingSession: true, sessionId });
    return streamsAIJson({ ok: true, messages: await messages.list(scope, sessionId) });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function memoryMessagesPOST(request: NextRequest) {
  try {
    const body = await readJsonBody<Body>(request);
    const userContent = (body.content || body.message || "").trim();
    if (!userContent) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);
    const scope = await requireStreamsAIScope(request);
    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", userContent);
      const userMessage = await messages.create(scope, { sessionId, role: body.role || "user", content: userContent, status: body.status || "complete", metadata: buildUserMetadata(body) });
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }
    return streamProvider(scope, body, userContent);
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamProvider(scope: StreamsAIScope, body: Body, userContent: string) {
  const startedAt = Date.now();
  return sse(new ReadableStream<Uint8Array>({ async start(controller) {
    const send: Send = (event, payload) => emit(controller, event, payload);
    let sessionId = body.sessionId || "";
    try {
      send("activity", { phase: "openai.responses.started", statusText: "Using live OpenAI Responses…", source: SOURCE, startedAt, sessionId });
      const history = await getHistoryForPrompt(scope, sessionId, userContent);
      const attachmentContext = await buildAttachmentContext(scope, body, sessionId, send);
      const memoryContext = await retrieveMemoryWithTimeout(scope, userContent, 12);
      if (memoryContext.memories.length) send("activity", { phase: "memory.loaded", statusText: "Project context ready", source: "streams-memory", sessionId, backendProof: memoryContext.retrieval });
      const result = await providerChain({ scope, body, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId });
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: result.content, body, assistantStatus: "complete", assistantMetadata: { source: SOURCE, provider: result.provider, providerRoute: result.providerRoute, providerStatus: result.providerStatus, model: result.model, webGrounded: true, ungroundedFallbackUsed: false, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval, fileContextUsed: Boolean(body.attachments?.length), providerGenerated: true } });
      sessionId = persisted.sessionId;
      send("complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: "openai", providerRoute: "openai-responses", providerStatus: "ok", model: result.model, webGrounded: true, ungroundedFallbackUsed: false, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval, elapsedMs: Date.now() - startedAt });
      rememberTurn(scope, { sessionId, userContent, assistantContent: result.content, sourceMessageId: persisted.assistantMessageId, provider: "openai", providerStatus: "ok", metadata: { providerRoute: "openai-responses", model: result.model, webGrounded: true, ungroundedFallbackUsed: false, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval } });
    } catch (e) {
      const message = "Live OpenAI Responses could not complete this response right now. No ungrounded answer path was used. Please retry in a moment.";
      for (const token of chunks(message)) send("response", { token });
      send("complete", { ok: false, sessionId, provider: "openai", providerRoute: "openai-responses", providerStatus: "failed", webGrounded: false, ungroundedFallbackUsed: false, elapsedMs: Date.now() - startedAt, error: e instanceof Error ? e.message : String(e) });
    } finally {
      controller.close();
    }
  }}));
}

async function providerChain(input: { scope: StreamsAIScope; body: Body; history: any[]; userContent: string; attachmentContext: any; memoryContext: StreamsMemoryContext; send: Send; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const models = [process.env.OPENAI_RESPONSES_MODEL_NEXT || "gpt-5", process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1"].filter(Boolean);
  const failures: string[] = [];
  for (const model of models) {
    try {
      return await openaiResponsesAnswer({ ...input, apiKey, model });
    } catch (e) {
      failures.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`OpenAI Responses failed for all configured models. ${failures.join(" | ")}`);
}

function responseInput(input: { scope: StreamsAIScope; history: any[]; userContent: string; attachmentContext: any; memoryContext: StreamsMemoryContext }) {
  const items: any[] = [{ role: "system", content: [{ type: "input_text", text: systemPrompt(input.scope) }] }];
  for (const message of input.history.slice(-MAX_HISTORY_MESSAGES)) {
    const content = String(message.content || "").trim();
    if (!content) continue;
    items.push({ role: message.role === "assistant" ? "assistant" : "user", content: [{ type: "input_text", text: content }] });
  }
  const userText = [input.memoryContext.promptBlock, input.attachmentContext.text, `User request:\n${input.userContent}`].filter(Boolean).join("\n\n");
  items.push({ role: "user", content: [{ type: "input_text", text: userText }] });
  return items;
}

function extractResponseText(json: any) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(json?.output) ? json.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      const text = content?.text || content?.output_text || content?.summary;
      if (typeof text === "string" && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join("\n\n").trim();
}

function emitResponseSources(json: any, send: Send, sessionId: string) {
  const seen = new Set<string>();
  const walk = (value: any) => {
    if (!value || typeof value !== "object") return;
    const url = typeof value.url === "string" ? value.url : typeof value.uri === "string" ? value.uri : "";
    if (url && /^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url);
      send("source", { title: String(value.title || value.name || url), url, source: "openai-web-search", sessionId });
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) walk(child);
  };
  walk(json);
}

async function openaiResponsesAnswer(input: { apiKey: string; model: string; scope: StreamsAIScope; body: Body; history: any[]; userContent: string; attachmentContext: any; memoryContext: StreamsMemoryContext; send: Send; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  input.send("activity", { phase: "openai.responses.model", statusText: `Trying ${input.model} with web search…`, source: SOURCE, sessionId: input.sessionId, backendProof: { provider: "openai", providerRoute: "openai-responses", model: input.model, webGrounded: true } });
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({ model: input.model, input: responseInput(input), tools: [{ type: "web_search_preview" }], max_output_tokens: 2200 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `OpenAI Responses request failed: ${res.status}`);
  emitResponseSources(json, input.send, input.sessionId);
  const content = extractResponseText(json);
  if (!content) throw new Error("OpenAI Responses returned no text output");
  for (const token of chunks(content)) input.send("response", { token });
  input.send("activity", { phase: "reasoning.duration", statusText: `Thought for ${duration(Date.now() - input.startedAt)}`, source: SOURCE, sessionId: input.sessionId, backendProof: { provider: "openai", providerRoute: "openai-responses", model: input.model, webGrounded: true, ungroundedFallbackUsed: false } });
  return { content, provider: "openai", model: input.model, providerStatus: "ok", webGrounded: true, providerRoute: "openai-responses", ungroundedFallbackUsed: false };
}
