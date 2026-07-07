import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { buildCanonicalCapabilityAnswer, buildRuntimeCapabilityRegistry, isCanonicalCapabilityQuestion } from "../capabilities/canonical-capabilities";
import { buildDeterministicFallbackAnswer, learnFromStreamsTurn, retrieveStreamsMemoryContext, type StreamsMemoryContext } from "../intelligence/memory-engine";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import { buildAttachmentContext, buildChatMessages, buildUserMetadata, ensureSession, getHistoryForPrompt, persistChatTurn, resolveAnthropicModel, resolveOpenAIModel } from "./messages-memory-provider-support";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const SOURCE = "streams-ai-memory-provider-router";
const MAX_HISTORY_MESSAGES = 16;
const MEMORY_RETRIEVAL_TIMEOUT_MS = 350;

type Body = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type Send = (event: string, payload: Record<string, unknown>) => void;
type ProviderResult = { content: string; provider: "openai" | "anthropic" | "streams-memory" | "streams"; model?: string | null; providerStatus: "ok" | "fallback" };

function sse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function chunks(text: string, size = 120) {
  const value = String(text || "");
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out;
}

function duration(ms: number) {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}

function authPresent(request: NextRequest) {
  const a = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const c = request.headers.get("cookie") || "";
  return /^Bearer\s+\S+/i.test(a) || /(?:^|;\s*)access_token=/.test(c) || /sb-[^=;]*-auth-token/.test(c);
}

function greeting(text: string) {
  return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)[.!?\s]*$/i.test(text.trim());
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
      new Promise<StreamsMemoryContext>((resolve) => {
        timer = setTimeout(() => resolve(timeoutMemory(userContent)), MEMORY_RETRIEVAL_TIMEOUT_MS);
      }),
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
    "You are Streams AI, Marcus Hawkins' AI business operator and product-building copilot inside the StreamsAI platform.",
    "You are not a generic chatbot. Answer as StreamsAI with the user's current product, repo, launch, and builder context in mind.",
    "Current product context: StreamsAI helps everyday small business owners, creators, and entrepreneurs turn ideas into business plans, visuals, content, websites, apps, automations, and launch actions.",
    "Core positioning: StreamsAI is for people who want to start or grow a business but do not know what to do next. It should act like an AI operator, not just a Q&A bot.",
    "When the user asks for marketing, launch, business, or product strategy for StreamsAI, give StreamsAI-specific actions, not generic market-research templates.",
    "When the user asks about development work, give direct answers with exact repo paths, file names, commits, status, and what is wired vs not verified whenever that context is available.",
    "Use retrieved Streams memory, project memory, file context, chat history, and tool results when supplied. If they are missing, say what is not verified instead of inventing.",
    "Project memory beats general memory. Recent user corrections beat older inferred preferences. Source documents beat summaries.",
    "Prefer concise, direct, practical answers. Avoid filler phrases, generic startup advice, and broad textbook steps unless the user explicitly asks for a general overview.",
    "For launch plans, include offer, target buyer, content angles, outreach motion, proof/demo assets, onboarding path, pricing test, and next execution steps.",
    "For Marcus, default to direct answers with exact files and commits when discussing implementation. Do not overclaim that something is working unless it is tested or verified.",
    "Do not ask which project when the active route/context is StreamsAI unless there is a real ambiguity. Assume the project is StreamsAI unless the user names another project.",
    "Do not pretend to run tools, builds, deployments, searches, generations, or image vision unless proof exists.",
    first ? `The signed-in account holder's first name is ${first}. Use it only at key personal moments.` : "No reliable first name is available. Do not invent one.",
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
    if (authPresent(request) && body.runAssistant !== false && greeting(userContent)) return streamGreeting(request, body, userContent);
    const scope = await requireStreamsAIScope(request);
    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", userContent);
      const userMessage = await messages.create(scope, { sessionId, role: body.role || "user", content: userContent, status: body.status || "complete", metadata: buildUserMetadata(body) });
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }
    if (isCanonicalCapabilityQuestion(userContent)) return streamCapabilities(scope, body, userContent);
    return streamProvider(scope, body, userContent);
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamGreeting(request: NextRequest, body: Body, userContent: string) {
  const startedAt = Date.now();
  const answer = "Hey — I’m here. What are we building or fixing next?";
  return sse(new ReadableStream<Uint8Array>({ async start(controller) {
    let sessionId = body.sessionId || "";
    emit(controller, "activity", { phase: "simple-greeting.started", statusText: "Writing…", source: SOURCE, startedAt, sessionId });
    emit(controller, "response", { token: answer });
    try {
      const scope = await requireStreamsAIScope(request);
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: answer, body, assistantStatus: "complete", assistantMetadata: { source: SOURCE, provider: "streams", providerStatus: "ok" } });
      sessionId = persisted.sessionId;
      emit(controller, "complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", elapsedMs: Date.now() - startedAt });
      rememberTurn(scope, { sessionId, userContent, assistantContent: answer, sourceMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok" });
    } catch (e) {
      emit(controller, "error", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      controller.close();
    }
  }}));
}

function streamCapabilities(scope: StreamsAIScope, body: Body, userContent: string) {
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();
  return sse(new ReadableStream<Uint8Array>({ async start(controller) {
    let sessionId = body.sessionId || "";
    emit(controller, "activity", { phase: "capabilities.started", statusText: "Writing…", source: SOURCE, startedAt, sessionId });
    for (const token of chunks(answer)) emit(controller, "response", { token });
    try {
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: answer, body, assistantStatus: "complete", assistantMetadata: { source: SOURCE, provider: "streams", providerStatus: "ok", registryVersion: registry.version, capabilityCount: registry.total } });
      sessionId = persisted.sessionId;
      emit(controller, "complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", elapsedMs: Date.now() - startedAt });
      rememberTurn(scope, { sessionId, userContent, assistantContent: answer, sourceMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok" });
    } catch (e) {
      emit(controller, "error", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      controller.close();
    }
  }}));
}

function streamProvider(scope: StreamsAIScope, body: Body, userContent: string) {
  const startedAt = Date.now();
  return sse(new ReadableStream<Uint8Array>({ async start(controller) {
    const send: Send = (event, payload) => emit(controller, event, payload);
    let sessionId = body.sessionId || "";
    try {
      send("activity", { phase: "router.started", statusText: "Writing…", source: SOURCE, startedAt, sessionId });
      const history = await getHistoryForPrompt(scope, sessionId, userContent);
      const attachmentContext = await buildAttachmentContext(scope, body, sessionId, send);
      const memoryContext = await retrieveMemoryWithTimeout(scope, userContent, 12);
      if (memoryContext.memories.length) send("activity", { phase: "memory.loaded", statusText: "Context ready", source: "streams-memory", sessionId, backendProof: memoryContext.retrieval });
      const result = await providerChain({ scope, body, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId });
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: result.content, body, assistantStatus: "complete", assistantMetadata: { source: SOURCE, provider: result.provider, providerStatus: result.providerStatus, model: result.model || null, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval, fileContextUsed: Boolean(body.attachments?.length), deterministicFallback: result.provider === "streams-memory" } });
      sessionId = persisted.sessionId;
      send("complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: result.provider, providerStatus: result.providerStatus, model: result.model || null, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval, elapsedMs: Date.now() - startedAt });
      rememberTurn(scope, { sessionId, userContent, assistantContent: result.content, sourceMessageId: persisted.assistantMessageId, provider: result.provider, providerStatus: result.providerStatus, metadata: { memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval } });
    } catch (e) {
      const memoryContext = await retrieveMemoryWithTimeout(scope, userContent, 12);
      const fallback = buildDeterministicFallbackAnswer({ userContent, memoryContext, providerStatus: "failed", providerName: "streams-memory", errorMessage: e instanceof Error ? e.message : String(e) });
      for (const token of chunks(fallback)) send("response", { token });
      send("complete", { ok: true, sessionId, provider: "streams-memory", providerStatus: "fallback", memoryRetrieval: memoryContext.retrieval, elapsedMs: Date.now() - startedAt });
    } finally {
      controller.close();
    }
  }}));
}

async function providerChain(input: { scope: StreamsAIScope; body: Body; history: any[]; userContent: string; attachmentContext: any; memoryContext: StreamsMemoryContext; send: Send; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const openAIKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const order = /claude|anthropic/i.test(String(input.body.provider || input.body.mode || "")) ? ["anthropic", "openai"] : ["openai", "anthropic"];
  const failures: string[] = [];
  for (const provider of order) {
    if (provider === "openai" && openAIKey) {
      try { return await openaiAnswer({ ...input, apiKey: openAIKey }); } catch (e) { failures.push(`openai: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (provider === "anthropic" && anthropicKey && !input.attachmentContext.imageParts.length) {
      try {
        const result = await anthropicAnswer({ ...input, apiKey: anthropicKey });
        for (const token of chunks(result.content)) input.send("response", { token });
        input.send("activity", { phase: "reasoning.duration", statusText: `Thought for ${duration(Date.now() - input.startedAt)}`, source: SOURCE, sessionId: input.sessionId, backendProof: { provider: "anthropic" } });
        return result;
      } catch (e) { failures.push(`anthropic: ${e instanceof Error ? e.message : String(e)}`); }
    }
  }
  const fallback = buildDeterministicFallbackAnswer({ userContent: input.userContent, memoryContext: input.memoryContext, attachmentText: input.attachmentContext.text, hasImageParts: input.attachmentContext.imageParts.length > 0, providerStatus: openAIKey || anthropicKey ? "failed" : "not_configured", providerName: "streams-memory", errorMessage: failures.join("\n") });
  for (const token of chunks(fallback)) input.send("response", { token });
  return { content: fallback, provider: "streams-memory", providerStatus: "fallback" };
}

async function openaiAnswer(input: { apiKey: string; scope: StreamsAIScope; body: Body; history: any[]; userContent: string; attachmentContext: any; memoryContext: StreamsMemoryContext; send: Send; startedAt: number; sessionId: string }): Promise<ProviderResult> {
  const model = resolveOpenAIModel(input.body.mode);
  const client = new OpenAI({ apiKey: input.apiKey });
  const stream = await client.chat.completions.create({ model, messages: buildChatMessages(input.history, input.userContent, input.scope, input.attachmentContext, input.memoryContext), stream: true, temperature: 0.7 });
  let content = "";
  for await (const part of stream) {
    const token = part.choices?.[0]?.delta?.content || "";
    if (!token) continue;
    content += token;
    input.send("response", { token });
  }
  input.send("activity", { phase: "reasoning.duration", statusText: `Thought for ${duration(Date.now() - input.startedAt)}`, source: SOURCE, sessionId: input.sessionId, backendProof: { provider: "openai" } });
  return { content, provider: "openai", model, providerStatus: "ok" };
}

async function anthropicAnswer(input: { apiKey: string; scope: StreamsAIScope; body: Body; history: any[]; userContent: string; attachmentContext: any; memoryContext: StreamsMemoryContext }): Promise<ProviderResult> {
  const model = resolveAnthropicModel(input.body.mode);
  const text = [input.memoryContext.promptBlock, input.attachmentContext.text, `User request:\n${input.userContent}`].filter(Boolean).join("\n\n");
  const history = input.history.slice(MAX_HISTORY_MESSAGES * -1).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })).filter((m) => m.content.trim());
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": input.apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 1800, system: systemPrompt(input.scope), messages: [...history, { role: "user", content: text }] }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Anthropic request failed: ${res.status}`);
  const content = Array.isArray(json?.content) ? json.content.map((p: any) => p?.text || "").join("") : "";
  return { content, provider: "anthropic", model, providerStatus: "ok" };
}
