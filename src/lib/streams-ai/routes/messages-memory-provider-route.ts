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
const CAPABILITY_SOURCE = "streams-ai-capability-memory";
const SIMPLE_SOURCE = "streams-ai-simple-greeting";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_PRO_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const MAX_HISTORY_MESSAGES = 16;
const MAX_ATTACHMENT_CONTEXT_CHARS = 36000;

type StreamSend = (event: string, payload: Record<string, unknown>) => void;
type PersistedChatMessage = { id?: string; role?: string | null; content?: string | null; metadata?: Record<string, any> | null };
type ChatPostBody = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type AttachmentContext = { text: string; imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[]; statusText: string; statusEvents: string[] };
type ProviderResult = { content: string; provider: "openai" | "anthropic" | "streams-memory" | "streams"; model?: string | null; providerStatus: "ok" | "failed" | "not_configured" | "fallback"; error?: string };

const SYSTEM_PROMPT_BASE = [
  "You are Streams AI, a provider-agnostic AI business operator inside Streams.",
  "Use retrieved Streams memory, project memory, file context, and tool results when supplied.",
  "When uploaded file context is supplied, answer from it. Do not say you cannot access the file when readable context is present.",
  "When image vision input is supplied, inspect the image directly. If no vision provider is available, be honest and use metadata/context only.",
  "Do not pretend to run tools, builds, deployments, searches, or generations unless the system returns proof.",
  "Project memory beats general memory. Recent user corrections beat older inferred preferences. Source documents beat summaries.",
  "Keep responses direct, practical, and useful for building, creating, launching, or fixing the next thing.",
].join("\n");

function buildSystemPrompt(scope: StreamsAIScope) {
  const firstName = String(scope.userFirstName || "").trim();
  return firstName ? `${SYSTEM_PROMPT_BASE}\nThe signed-in account holder's first name is ${firstName}. Use it only at key personal moments, not every reply.` : `${SYSTEM_PROMPT_BASE}\nNo reliable first name is available. Do not invent one.`;
}

export async function streamsMessagesGET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    const session = await sessions.get(scope, sessionId);
    if (!session) return streamsAIJson({ ok: false, error: "Session not found" }, 404);
    const data = await messages.list(scope, sessionId);
    return streamsAIJson({ ok: true, messages: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function streamsMessagesPOST(request: NextRequest) {
  try {
    const body = await readJsonBody<ChatPostBody>(request);
    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);
    if (isAuthPresent(request) && body.runAssistant !== false && isSimpleGreetingPrompt(content)) return streamSimpleGreetingResponse({ request, sessionId: body.sessionId || "", userContent: content, body });
    const scope = await requireStreamsAIScope(request);
    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", content);
      const userMessage = await messages.create(scope, { sessionId, role: body.role || "user", content, status: body.status || "complete", metadata: buildUserMetadata(body) });
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }
    if (isCanonicalCapabilityQuestion(content)) return streamCanonicalCapabilityResponse({ scope, sessionId: body.sessionId || "", userContent: content, body });
    return streamProviderRouterResponse({ scope, sessionId: body.sessionId || "", userContent: content, mode: body.mode, body });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamSimpleGreetingResponse({ request, sessionId, userContent, body }: { request: NextRequest; sessionId: string; userContent: string; body: ChatPostBody }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const assistantContent = "Hey — I’m here. What are we building or fixing next?";
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    let persistedSessionId = sessionId;
    try {
      send("activity", { phase: "simple-greeting.started", statusText: "Writing…", source: SIMPLE_SOURCE, startedAt, sessionId: persistedSessionId });
      send("response", { token: assistantContent });
      try {
        const scope = await requireStreamsAIScope(request);
        const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: SIMPLE_SOURCE, provider: "streams", providerStatus: "ok", fastPath: "simple-greeting" } });
        persistedSessionId = persisted.sessionId;
        await learnFromStreamsTurn(scope, { sessionId: persistedSessionId, projectId: null, userContent, assistantContent, sourceMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok" }).catch(() => null);
        send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", source: SIMPLE_SOURCE, elapsedMs: Date.now() - startedAt });
      } catch (persistError) {
        send("complete", { ok: true, sessionId: persistedSessionId, provider: "streams", providerStatus: "not_persisted", source: SIMPLE_SOURCE, elapsedMs: Date.now() - startedAt, persistError: persistError instanceof Error ? persistError.message : String(persistError) });
      }
    } catch (error) { send("error", { message: error instanceof Error ? error.message : String(error) }); }
    finally { controller.close(); }
  }});
  return sseResponse(stream);
}

function streamCanonicalCapabilityResponse({ scope, sessionId, userContent, body }: { scope: StreamsAIScope; sessionId: string; userContent: string; body: ChatPostBody }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    let persistedSessionId = sessionId;
    try {
      send("activity", { phase: "capabilities.started", statusText: "Writing…", source: CAPABILITY_SOURCE, startedAt, sessionId: persistedSessionId });
      for (const token of chunkText(answer, 120)) send("response", { token });
      const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent: answer, body, assistantStatus: "complete", assistantMetadata: { source: CAPABILITY_SOURCE, provider: "streams", providerStatus: "ok", registryVersion: registry.version, capabilityCount: registry.total } });
      persistedSessionId = persisted.sessionId;
      await learnFromStreamsTurn(scope, { sessionId: persistedSessionId, projectId: null, userContent, assistantContent: answer, sourceMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", metadata: { capabilityResponse: true } }).catch(() => null);
      send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", source: CAPABILITY_SOURCE, elapsedMs: Date.now() - startedAt });
    } catch (error) { send("error", { message: error instanceof Error ? error.message : String(error) }); }
    finally { controller.close(); }
  }});
  return sseResponse(stream);
}

function streamProviderRouterResponse({ scope, sessionId, userContent, mode, body }: { scope: StreamsAIScope; sessionId: string; userContent: string; mode?: string; body: ChatPostBody }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    let persistedSessionId = sessionId;
    let assistantContent = "";
    let providerResult: ProviderResult = { content: "", provider: "streams-memory", providerStatus: "fallback" };
    try {
      send("activity", { phase: "router.started", statusText: "Writing…", source: LIVE_SOURCE, startedAt, sessionId: persistedSessionId });
      const history = await getHistoryForPrompt(scope, persistedSessionId, userContent);
      if (body.attachments?.length) send("activity", { phase: "attachments.reading", statusText: body.attachments.length === 1 ? "Reading attached file…" : `Reading ${body.attachments.length} attached files…`, source: LIVE_SOURCE, sessionId: persistedSessionId, backendProof: { attachmentCount: body.attachments.length } });
      const attachmentContext = await buildAttachmentContext(scope, body, persistedSessionId);
      for (const statusText of attachmentContext.statusEvents) send("activity", { phase: "attachments.proof", statusText, source: LIVE_SOURCE, sessionId: persistedSessionId, backendProof: { attachmentContextReady: true } });
      const memoryContext = await retrieveStreamsMemoryContext(scope, { userContent, limit: 12 }).catch(() => emptyMemoryContext(userContent));
      if (memoryContext.memories.length) send("activity", { phase: "memory.loaded", statusText: "Context ready", source: "streams-memory", sessionId: persistedSessionId, backendProof: memoryContext.retrieval });
      providerResult = await runProviderChain({ scope, mode, body, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId: persistedSessionId });
      assistantContent = providerResult.content || buildDeterministicFallbackAnswer({ userContent, memoryContext, attachmentText: attachmentContext.text, hasImageParts: attachmentContext.imageParts.length > 0, providerStatus: "unavailable", providerName: "streams-memory" });
      if (!providerResult.content) for (const token of chunkText(assistantContent, 120)) send("response", { token });
      const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: LIVE_SOURCE, provider: providerResult.provider, providerStatus: providerResult.providerStatus, model: providerResult.model || null, runtimeContract: "streams_memory_provider_router_v1", memoryCount: memoryContext.memories.length, fileContextUsed: Boolean(body.attachments?.length), deterministicFallback: providerResult.provider === "streams-memory" } });
      persistedSessionId = persisted.sessionId;
      await learnFromStreamsTurn(scope, { sessionId: persistedSessionId, projectId: null, userContent, assistantContent, sourceMessageId: persisted.assistantMessageId, provider: providerResult.provider, providerStatus: providerResult.providerStatus, metadata: { memoryCount: memoryContext.memories.length, deterministicFallback: providerResult.provider === "streams-memory" } }).catch(() => null);
      send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: providerResult.provider, providerStatus: providerResult.providerStatus, model: providerResult.model || null, elapsedMs: Date.now() - startedAt, source: LIVE_SOURCE, memoryCount: memoryContext.memories.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown provider failure");
      const memoryContext = await retrieveStreamsMemoryContext(scope, { userContent, limit: 12 }).catch(() => emptyMemoryContext(userContent));
      assistantContent = buildDeterministicFallbackAnswer({ userContent, memoryContext, providerStatus: "failed", providerName: "streams-memory", errorMessage: message });
      try { const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: LIVE_SOURCE, provider: "streams-memory", providerStatus: "fallback", providerError: message } }); persistedSessionId = persisted.sessionId; } catch {}
      for (const token of chunkText(assistantContent, 120)) send("response", { token });
      send("complete", { ok: true, sessionId: persistedSessionId, provider: "streams-memory", providerStatus: "fallback", elapsedMs: Date.now() - startedAt, source: LIVE_SOURCE });
    } finally { controller.close(); }
  }});
  return sseResponse(stream);
}

async function runProviderChain({ scope, mode, body, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId }: { scope: StreamsAIScope; mode?: string; body: ChatPostBody; history: PersistedChatMessage[]; userContent: string; attachmentContext: AttachmentContext; memoryContext: StreamsMemoryContext; send: StreamSend; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const openAIKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const preferClaude = /claude|anthropic/i.test(String(body.provider || mode || ""));
  const providers = preferClaude ? ["anthropic", "openai"] : ["openai", "anthropic"];
  const failures: string[] = [];
  for (const provider of providers) {
    if (provider === "openai" && openAIKey) {
      try { return await streamOpenAI({ apiKey: openAIKey, scope, mode, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId }); }
      catch (error) { failures.push(`openai: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (provider === "anthropic" && anthropicKey && !attachmentContext.imageParts.length) {
      try {
        const result = await completeAnthropic({ apiKey: anthropicKey, scope, mode, history, userContent, attachmentContext, memoryContext });
        for (const token of chunkText(result.content, 120)) send("response", { token });
        send("activity", { phase: "reasoning.duration", statusText: `Thought for ${formatDuration(Date.now() - startedAt)}`, source: LIVE_SOURCE, sessionId, backendProof: { elapsedMs: Date.now() - startedAt, provider: "anthropic" } });
        return result;
      } catch (error) { failures.push(`anthropic: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }
  const fallback = buildDeterministicFallbackAnswer({ userContent, memoryContext, attachmentText: attachmentContext.text, hasImageParts: attachmentContext.imageParts.length > 0, providerStatus: openAIKey || anthropicKey ? "failed" : "not_configured", providerName: "streams-memory", errorMessage: failures.join("\n") });
  for (const token of chunkText(fallback, 120)) send("response", { token });
  return { content: fallback, provider: "streams-memory", providerStatus: "fallback", error: failures.join("\n") };
}

async function streamOpenAI({ apiKey, scope, mode, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId }: { apiKey: string; scope: StreamsAIScope; mode?: string; history: PersistedChatMessage[]; userContent: string; attachmentContext: AttachmentContext; memoryContext: StreamsMemoryContext; send: StreamSend; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const model = resolveOpenAIModel(mode);
  const client = new OpenAI({ apiKey });
  let content = "";
  const openaiStream = await client.chat.completions.create({ model, messages: buildChatMessages(history, userContent, scope, attachmentContext, memoryContext), stream: true, temperature: 0.7 });
  for await (const part of openaiStream) { const token = part.choices?.[0]?.delta?.content || ""; if (!token) continue; content += token; send("response", { token }); }
  send("activity", { phase: "reasoning.duration", statusText: `Thought for ${formatDuration(Date.now() - startedAt)}`, source: LIVE_SOURCE, sessionId, backendProof: { elapsedMs: Date.now() - startedAt, provider: "openai" } });
  return { content, provider: "openai", model, providerStatus: "ok" };
}

async function completeAnthropic({ apiKey, scope, mode, history, userContent, attachmentContext, memoryContext }: { apiKey: string; scope: StreamsAIScope; mode?: string; history: PersistedChatMessage[]; userContent: string; attachmentContext: AttachmentContext; memoryContext: StreamsMemoryContext }): Promise<ProviderResult> {
  const model = resolveAnthropicModel(mode);
  const text = [memoryContext.promptBlock, attachmentContext.text, `User request:\n${userContent}`].filter(Boolean).join("\n\n");
  const usable = history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: String(message.content || "") })).filter((message) => message.content.trim());
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 1800, system: buildSystemPrompt(scope), messages: [...usable, { role: "user", content: text }] }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || json?.message || `Anthropic request failed: ${response.status}`);
  const content = Array.isArray(json?.content) ? json.content.map((part: any) => part?.text || "").join("") : "";
  return { content, provider: "anthropic", model, providerStatus: "ok" };
}

async function getHistoryForPrompt(scope: StreamsAIScope, sessionId: string, userContent: string) { if (!sessionId) return [] as PersistedChatMessage[]; if (isFastStandalonePrompt(userContent)) return [] as PersistedChatMessage[]; return messages.list(scope, sessionId).catch(() => [] as PersistedChatMessage[]); }
function isSimpleGreetingPrompt(content: string) { return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)[.!?\s]*$/i.test(content.trim()); }
function isFastStandalonePrompt(content: string) { return /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|yes|no|cool|great|good morning|good afternoon|good evening)[.!?\s]*$/i.test(content.trim()); }
function isAuthPresent(request: NextRequest) { const authorization = request.headers.get("authorization") || request.headers.get("Authorization") || ""; if (/^Bearer\s+\S+/i.test(authorization)) return true; const cookie = request.headers.get("cookie") || ""; return /(?:^|;\s*)access_token=/.test(cookie) || /sb-[^=;]*-auth-token/.test(cookie); }
async function ensureSession(scope: StreamsAIScope, sessionId: string, content: string) { if (sessionId) return sessionId; const created = await sessions.create(scope, { title: buildFastTitle(content), metadata: { source: "streams-ai-chat-ui", assistantRuntime: LIVE_SOURCE, mode: "provider-router-memory", recentChat: true } }); return created.id; }
async function persistChatTurn({ scope, sessionId, userContent, assistantContent, body, assistantStatus, assistantMetadata }: { scope: StreamsAIScope; sessionId: string; userContent: string; assistantContent: string; body: ChatPostBody; assistantStatus: string; assistantMetadata: Record<string, unknown> }) { const persistedSessionId = await ensureSession(scope, sessionId, userContent); await messages.create(scope, { sessionId: persistedSessionId, role: body.role || "user", content: userContent, status: body.status || "complete", metadata: buildUserMetadata(body) }); const assistantMessage = await messages.create(scope, { sessionId: persistedSessionId, role: "assistant", content: assistantContent, status: assistantStatus, metadata: assistantMetadata }); return { sessionId: persistedSessionId, assistantMessageId: assistantMessage.id }; }
function buildUserMetadata(body: ChatPostBody) { return { ...(body.metadata || {}), copiedUiUserId: body.userId || null, assistantRuntime: LIVE_SOURCE, mode: "provider-router-memory", attachments: body.attachments || [] }; }
