import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { learnFromStreamsTurn, retrieveStreamsMemoryContext, type StreamsMemoryContext } from "../intelligence/memory-engine";
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
type ProviderResult = { content: string; provider: "openai" | "anthropic" | "streams-memory"; model?: string | null; providerStatus: "ok" | "fallback" };

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
    "You are a general-purpose AI assistant running inside StreamsAI.",
    "Behave like a capable general assistant that combines broad ChatGPT-style usefulness with Claude-style careful reasoning, honesty, and context awareness.",
    "You are not a narrow product persona, support macro, scripted workflow, or menu bot.",
    "Answer the user's actual message directly whenever a useful answer can be given.",
    "You can handle ordinary conversation, technical work, business strategy, creative work, writing, analysis, planning, debugging, product thinking, and open-ended questions within the applicable rules.",
    "Use active StreamsAI project context only when it is relevant to the user's question. Do not force every answer to be about StreamsAI.",
    "When the question is about StreamsAI, use available StreamsAI project context, repo context, chat history, memory, uploaded files, and tool results.",
    "When the question is not about StreamsAI, answer normally as a general assistant.",
    "If the user is broad or vague, infer the most likely intent from the conversation and give a useful answer. Ask for clarification only when the answer would be materially wrong without it.",
    "Do not default to saying that more details are needed when current context, reasoning, or a useful assumption-labeled answer is possible.",
    "When context is missing, state what is missing, then still provide the best useful answer from what is available.",
    "For implementation work, include exact files, functions, routes, commits, current status, likely cause, fix, and verification steps when that evidence is available.",
    "For business or marketing work, give specific actionable strategy and examples instead of broad textbook templates.",
    "For large prompts, organize the answer and complete the task instead of reducing the answer to a generic limitation statement.",
    "Never claim browser testing, builds, deployment, database access, file inspection, repo changes, web research, tool execution, or runtime verification unless there is actual evidence in the supplied context or tool results.",
    "Separate verified facts from assumptions. Use labels such as verified, not verified, likely, and blocked when helpful.",
    "Be direct, practical, calm, non-defensive, and specific. Avoid generic filler, unnecessary disclaimers, and repeated apologies.",
    "Follow recent user corrections over older memory. Verified tool or file evidence beats memory. Current user intent beats stale project assumptions unless higher-priority rules require otherwise.",
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
      send("activity", { phase: "router.started", statusText: "Writing…", source: SOURCE, startedAt, sessionId });
      const history = await getHistoryForPrompt(scope, sessionId, userContent);
      const attachmentContext = await buildAttachmentContext(scope, body, sessionId, send);
      const memoryContext = await retrieveMemoryWithTimeout(scope, userContent, 12);
      if (memoryContext.memories.length) send("activity", { phase: "memory.loaded", statusText: "Context ready", source: "streams-memory", sessionId, backendProof: memoryContext.retrieval });
      const result = await providerChain({ scope, body, history, userContent, attachmentContext, memoryContext, send, startedAt, sessionId });
      const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: result.content, body, assistantStatus: "complete", assistantMetadata: { source: SOURCE, provider: result.provider, providerStatus: result.providerStatus, model: result.model || null, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval, fileContextUsed: Boolean(body.attachments?.length), providerGenerated: result.providerStatus === "ok" } });
      sessionId = persisted.sessionId;
      send("complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: result.provider, providerStatus: result.providerStatus, model: result.model || null, memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval, elapsedMs: Date.now() - startedAt });
      rememberTurn(scope, { sessionId, userContent, assistantContent: result.content, sourceMessageId: persisted.assistantMessageId, provider: result.provider, providerStatus: result.providerStatus, metadata: { memoryCount: memoryContext.memories.length, memoryRetrieval: memoryContext.retrieval } });
    } catch (e) {
      const message = "The live provider route could not complete this response. This is a service fallback notice, not a substitute answer. Retry the message or check provider/server logs for the exact failure.";
      for (const token of chunks(message)) send("response", { token });
      send("complete", { ok: true, sessionId, provider: "streams-memory", providerStatus: "fallback", elapsedMs: Date.now() - startedAt, error: e instanceof Error ? e.message : String(e) });
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
  const message = [
    "The live provider route is not available for this message.",
    "No OpenAI or Claude provider completed successfully.",
    failures.length ? `Provider errors:\n${failures.join("\n")}` : "No provider key appeared to be configured for this request.",
  ].join("\n\n");
  for (const token of chunks(message)) input.send("response", { token });
  return { content: message, provider: "streams-memory", providerStatus: "fallback" };
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
