import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { buildCanonicalCapabilityAnswer, buildRuntimeCapabilityRegistry, isCanonicalCapabilityQuestion } from "../capabilities/canonical-capabilities";
import { StreamsAIAssetsRepository } from "../repositories/assets-repository";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import { createStreamsAIServiceClient } from "../server";
import { buildDeterministicFallbackAnswer, learnFromStreamsTurn, retrieveStreamsMemoryContext, type StreamsMemoryContext } from "../intelligence/memory-engine";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const assets = new StreamsAIAssetsRepository();

const LIVE_SOURCE = "streams-ai-memory-provider-router";
const SIMPLE_SOURCE = "streams-ai-simple-greeting";
const CAPABILITY_SOURCE = "streams-ai-capability-memory";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_PRO_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const MAX_HISTORY_MESSAGES = 16;
const MAX_ATTACHMENT_CONTEXT_CHARS = 36000;

type StreamSend = (event: string, payload: Record<string, unknown>) => void;
type PersistedChatMessage = { id?: string; role?: string | null; content?: string | null; metadata?: Record<string, any> | null };
type ChatPostBody = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type AttachmentContext = { text: string; imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[]; statusText: string; statusEvents: string[] };
type ProviderResult = { content: string; provider: "openai" | "anthropic" | "streams-memory" | "streams"; model?: string | null; providerStatus: "ok" | "fallback"; error?: string };

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
function sendSse(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}
function chunkText(text: string, max = 120) {
  const value = String(text || "");
  if (!value) return [];
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += max) chunks.push(value.slice(index, index + max));
  return chunks;
}
function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}
function isSimpleGreetingPrompt(content: string) { return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)[.!?\s]*$/i.test(content.trim()); }
function isFastStandalonePrompt(content: string) { return /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|yes|no|cool|great|good morning|good afternoon|good evening)[.!?\s]*$/i.test(content.trim()); }
function isAuthPresent(request: NextRequest) { const auth = request.headers.get("authorization") || request.headers.get("Authorization") || ""; if (/^Bearer\s+\S+/i.test(auth)) return true; const cookie = request.headers.get("cookie") || ""; return /(?:^|;\s*)access_token=/.test(cookie) || /sb-[^=;]*-auth-token/.test(cookie); }
function resolveOpenAIModel(mode?: string) { return mode === "Pro" ? process.env.OPENAI_PRO_MODEL || DEFAULT_PRO_MODEL : process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || DEFAULT_FAST_MODEL; }
function resolveAnthropicModel(mode?: string) { return mode === "Pro" ? process.env.ANTHROPIC_PRO_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL : process.env.ANTHROPIC_FAST_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL; }
function buildFastTitle(content: string) { const cleaned = content.replace(/\s+/g, " ").trim(); return cleaned.length > 58 ? `${cleaned.slice(0, 55)}…` : cleaned || "New chat"; }
function emptyMemoryContext(query: string): StreamsMemoryContext { return { memories: [], promptBlock: "", retrieval: { source: "streams-memory", query, memoryCount: 0, scopes: [], strategy: ["empty"] } }; }

function buildSystemPrompt(scope: StreamsAIScope) {
  const firstName = String(scope.userFirstName || "").trim();
  return [
    "You are Streams AI, a provider-agnostic AI business operator inside Streams.",
    "Use retrieved Streams memory, project memory, file context, and tool results when supplied.",
    "Project memory beats general memory. Recent user corrections beat older inferred preferences. Source documents beat summaries.",
    "Do not pretend to run tools, builds, deployments, searches, generations, or image vision unless real proof/provider support exists.",
    "Keep responses direct, practical, and useful for building, creating, launching, or fixing the next thing.",
    firstName ? `The signed-in account holder's first name is ${firstName}. Use it only at key personal moments.` : "No reliable first name is available. Do not invent one.",
  ].join("\n");
}

export async function streamsMessagesGET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    const session = await sessions.get(scope, sessionId);
    if (!session) return streamsAIJson({ ok: false, error: "Session not found" }, 404);
    return streamsAIJson({ ok: true, messages: await messages.list(scope, sessionId) });
  } catch (error) { return streamsAIError(error); }
}

export async function streamsMessagesPOST(request: NextRequest) {
  try {
    const body = await readJsonBody<ChatPostBody>(request);
    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);
    if (isAuthPresent(request) && body.runAssistant !== false && isSimpleGreetingPrompt(content)) return streamGreeting({ request, sessionId: body.sessionId || "", userContent: content, body });
    const scope = await requireStreamsAIScope(request);
    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", content);
      const userMessage = await messages.create(scope, { sessionId, role: body.role || "user", content, status: body.status || "complete", metadata: buildUserMetadata(body) });
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }
    if (isCanonicalCapabilityQuestion(content)) return streamCapabilities({ scope, sessionId: body.sessionId || "", userContent: content, body });
    return streamProviderRouter({ scope, sessionId: body.sessionId || "", userContent: content, mode: body.mode, body });
  } catch (error) { return streamsAIError(error); }
}

function streamGreeting({ request, sessionId, userContent, body }: { request: NextRequest; sessionId: string; userContent: string; body: ChatPostBody }) {
  const startedAt = Date.now();
  const assistantContent = "Hey — I’m here. What are we building or fixing next?";
  return sseResponse(new ReadableStream<Uint8Array>({ async start(controller) {
    let persistedSessionId = sessionId;
    try {
      sendSse(controller, "activity", { phase: "simple-greeting.started", statusText: "Writing…", source: SIMPLE_SOURCE, startedAt, sessionId });
      sendSse(controller, "response", { token: assistantContent });
      const scope = await requireStreamsAIScope(request);
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: SIMPLE_SOURCE, provider: "streams", providerStatus: "ok" } });
      persistedSessionId = persisted.sessionId;
      await learnFromStreamsTurn(scope, { sessionId: persistedSessionId, userContent, assistantContent, sourceMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok" }).catch(() => null);
      sendSse(controller, "complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", elapsedMs: Date.now() - startedAt });
    } catch (error) { sendSse(controller, "error", { message: error instanceof Error ? error.message : String(error) }); }
    finally { controller.close(); }
  }}));
}

function streamCapabilities({ scope, sessionId, userContent, body }: { scope: StreamsAIScope; sessionId: string; userContent: string; body: ChatPostBody }) {
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();
  return sseResponse(new ReadableStream<Uint8Array>({ async start(controller) {
    let persistedSessionId = sessionId;
    try {
      sendSse(controller, "activity", { phase: "capabilities.started", statusText: "Writing…", source: CAPABILITY_SOURCE, startedAt, sessionId });
      for (const token of chunkText(answer)) sendSse(controller, "response", { token });
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: answer, body, assistantStatus: "complete", assistantMetadata: { source: CAPABILITY_SOURCE, provider: "streams", providerStatus: "ok", registryVersion: registry.version, capabilityCount: registry.total } });
      persistedSessionId = persisted.sessionId;
      await learnFromStreamsTurn(scope, { sessionId: persistedSessionId, userContent, assistantContent: answer, sourceMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok" }).catch(() => null);
      sendSse(controller, "complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", elapsedMs: Date.now() - startedAt });
    } catch (error) { sendSse(controller, "error", { message: error instanceof Error ? error.message : String(error) }); }
    finally { controller.close(); }
  }}));
}

function streamProviderRouter({ scope, sessionId, userContent, mode, body }: { scope: StreamsAIScope; sessionId: string; userContent: string; mode?: string; body: ChatPostBody }) {
  const startedAt = Date.now();
  return sseResponse(new ReadableStream<Uint8Array>({ async start(controller) {
    let persistedSessionId = sessionId;
    try {
      const send: StreamSend = (event, payload) => sendSse(controller, event, payload);
      send("activity", { phase: "router.started", statusText: "Writing…", source: LIVE_SOURCE, startedAt, sessionId });
      const history = await getHistoryForPrompt(scope, sessionId, userContent);
      const attachmentContext = await buildAttachmentContext(scope, body, sessionId, send);
      const memoryContext = await retrieveStreamsMemoryContext(scope, { userContent, limit: 12 }).catch(() => emptyMemoryContext(userContent));
      if (memoryContext.memories.length) send("activity", { phase: "memory.loaded", statusText: "Context ready", source: "streams-memory", sessionId, backendProof: memoryContext.retrieval });
      const result = await runProviderChain({ scope, mode, body, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId });
      const assistantContent = result.content;
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: LIVE_SOURCE, provider: result.provider, providerStatus: result.providerStatus, model: result.model || null, memoryCount: memoryContext.memories.length, fileContextUsed: Boolean(body.attachments?.length), deterministicFallback: result.provider === "streams-memory" } });
      persistedSessionId = persisted.sessionId;
      await learnFromStreamsTurn(scope, { sessionId: persistedSessionId, userContent, assistantContent, sourceMessageId: persisted.assistantMessageId, provider: result.provider, providerStatus: result.providerStatus, metadata: { memoryCount: memoryContext.memories.length } }).catch(() => null);
      send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: result.provider, providerStatus: result.providerStatus, model: result.model || null, memoryCount: memoryContext.memories.length, elapsedMs: Date.now() - startedAt });
    } catch (error) {
      const memoryContext = await retrieveStreamsMemoryContext(scope, { userContent, limit: 12 }).catch(() => emptyMemoryContext(userContent));
      const fallback = buildDeterministicFallbackAnswer({ userContent, memoryContext, providerStatus: "failed", providerName: "streams-memory", errorMessage: error instanceof Error ? error.message : String(error) });
      for (const token of chunkText(fallback)) sendSse(controller, "response", { token });
      sendSse(controller, "complete", { ok: true, sessionId: persistedSessionId, provider: "streams-memory", providerStatus: "fallback", elapsedMs: Date.now() - startedAt });
    } finally { controller.close(); }
  }}));
}

async function runProviderChain(input: { scope: StreamsAIScope; mode?: string; body: ChatPostBody; history: PersistedChatMessage[]; userContent: string; attachmentContext: AttachmentContext; memoryContext: StreamsMemoryContext; send: StreamSend; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const openAIKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const preferClaude = /claude|anthropic/i.test(String(input.body.provider || input.mode || ""));
  const order = preferClaude ? ["anthropic", "openai"] : ["openai", "anthropic"];
  const failures: string[] = [];
  for (const provider of order) {
    if (provider === "openai" && openAIKey) {
      try { return await streamOpenAI({ ...input, apiKey: openAIKey }); } catch (error) { failures.push(`openai: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (provider === "anthropic" && anthropicKey && !input.attachmentContext.imageParts.length) {
      try { const result = await completeAnthropic({ ...input, apiKey: anthropicKey }); for (const token of chunkText(result.content)) input.send("response", { token }); input.send("activity", { phase: "reasoning.duration", statusText: `Thought for ${formatDuration(Date.now() - input.startedAt)}`, source: LIVE_SOURCE, sessionId: input.sessionId, backendProof: { provider: "anthropic" } }); return result; } catch (error) { failures.push(`anthropic: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }
  const fallback = buildDeterministicFallbackAnswer({ userContent: input.userContent, memoryContext: input.memoryContext, attachmentText: input.attachmentContext.text, hasImageParts: input.attachmentContext.imageParts.length > 0, providerStatus: openAIKey || anthropicKey ? "failed" : "not_configured", providerName: "streams-memory", errorMessage: failures.join("\n") });
  for (const token of chunkText(fallback)) input.send("response", { token });
  return { content: fallback, provider: "streams-memory", providerStatus: "fallback", error: failures.join("\n") };
}

async function streamOpenAI(input: { apiKey: string; scope: StreamsAIScope; mode?: string; history: PersistedChatMessage[]; userContent: string; attachmentContext: AttachmentContext; memoryContext: StreamsMemoryContext; send: StreamSend; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const model = resolveOpenAIModel(input.mode);
  const client = new OpenAI({ apiKey: input.apiKey });
  const openaiStream = await client.chat.completions.create({ model, messages: buildChatMessages(input.history, input.userContent, input.scope, input.attachmentContext, input.memoryContext), stream: true, temperature: 0.7 });
  let content = "";
  for await (const part of openaiStream) { const token = part.choices?.[0]?.delta?.content || ""; if (!token) continue; content += token; input.send("response", { token }); }
  input.send("activity", { phase: "reasoning.duration", statusText: `Thought for ${formatDuration(Date.now() - input.startedAt)}`, source: LIVE_SOURCE, sessionId: input.sessionId, backendProof: { provider: "openai" } });
  return { content, provider: "openai", model, providerStatus: "ok" };
}

async function completeAnthropic(input: { apiKey: string; scope: StreamsAIScope; mode?: string; history: PersistedChatMessage[]; userContent: string; attachmentContext: AttachmentContext; memoryContext: StreamsMemoryContext }): Promise<ProviderResult> {
  const model = resolveAnthropicModel(input.mode);
  const text = [input.memoryContext.promptBlock, input.attachmentContext.text, `User request:\n${input.userContent}`].filter(Boolean).join("\n\n");
  const usable = input.history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })).filter((m) => m.content.trim());
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": input.apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 1800, system: buildSystemPrompt(input.scope), messages: [...usable, { role: "user", content: text }] }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || json?.message || `Anthropic request failed: ${response.status}`);
  const content = Array.isArray(json?.content) ? json.content.map((part: any) => part?.text || "").join("") : "";
  return { content, provider: "anthropic", model, providerStatus: "ok" };
}
