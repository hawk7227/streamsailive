import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import { buildAttachmentContext, buildUserMetadata, ensureSession, getHistoryForPrompt, persistChatTurn } from "./messages-memory-provider-support";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const SOURCE = "streams-ai-openai-responses-live";
const MAX_HISTORY_MESSAGES = 16;
const DEFAULT_TIME_ZONE = "America/Phoenix";
const DEFAULT_TIME_ZONE_LABEL = "MST";

type Body = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type Send = (event: string, payload: Record<string, unknown>) => void;

function sse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function chunks(text: string, size = 180) {
  const out: string[] = [];
  for (let i = 0; i < String(text || "").length; i += size) out.push(String(text || "").slice(i, i + size));
  return out.length ? out : [""];
}

function isTimeIntent(text: string) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;
  return /\b(what time is it|time now|current time|my time|time in my location|what'?s the time|show me the time)\b/.test(value);
}

function isOpenAILiveProofIntent(text: string) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;
  return /(openai.*live|live.*openai|api.*live|live.*api|server timestamp.*openai|openai.*server timestamp|web grounding.*test|live proof|prove.*openai|responses.*live)/i.test(value);
}

function formatLocalTime(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(date);
}

function extractResponseText(json: any) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(json?.output) ? json.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) parts.push(content.text.trim());
    }
  }
  return parts.join("\n\n").trim();
}

function modelList() {
  return [process.env.OPENAI_RESPONSES_MODEL_NEXT, process.env.OPENAI_RESPONSES_MODEL, process.env.OPENAI_SEARCH_MODEL, "gpt-4.1-mini"].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);
}

function systemPrompt(serverTimestamp: string) {
  return [
    "You are a general-purpose AI assistant running inside StreamsAI.",
    "StreamsAI is a general ChatGPT/Claude-style AI assistant platform with chat, uploads, files, writing, research, generation, coding, tools, workspaces, saved projects, and project flow.",
    "Use web search for current facts. Do not invent citations.",
    `Server request timestamp: ${serverTimestamp}`,
    "When asked for the server timestamp, repeat the exact ISO timestamp above. Do not convert it unless explicitly asked.",
    "For OpenAI live proof tests, first print the exact server timestamp supplied by the backend, then answer using web_search_preview.",
  ].join("\n");
}

async function callOpenAI(input: { apiKey: string; model: string; text: string; send: Send; sessionId: string; serverTimestamp: string }) {
  input.send("activity", { phase: "openai.responses.model", statusText: `Trying ${input.model} with web search…`, source: SOURCE, sessionId: input.sessionId, backendProof: { provider: "openai", providerRoute: "openai-responses", model: input.model, webGrounded: true, serverTimestamp: input.serverTimestamp } });
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: input.model,
      input: [
        { role: "system", content: systemPrompt(input.serverTimestamp) },
        { role: "user", content: input.text },
      ],
      tools: [{ type: "web_search_preview" }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `OpenAI Responses request failed: ${res.status}`);
  const content = extractResponseText(json);
  if (!content) throw new Error("OpenAI Responses returned no text output");
  return content;
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
    return sse(new ReadableStream<Uint8Array>({ async start(controller) {
      const send: Send = (event, payload) => emit(controller, event, payload);
      const startedAt = Date.now();
      const serverTimestamp = new Date(startedAt).toISOString();
      let sessionId = body.sessionId || "";
      try {
        send("activity", { phase: "server.timestamp", statusText: serverTimestamp, source: "streams-server-clock", sessionId, backendProof: { serverTimestamp } });
        if (isTimeIntent(userContent) && !isOpenAILiveProofIntent(userContent)) {
          const localTime = formatLocalTime(new Date(startedAt));
          const content = `Your current time in Arizona is ${localTime} ${DEFAULT_TIME_ZONE_LABEL}.\n\nServer timestamp: ${serverTimestamp}\nTimezone: ${DEFAULT_TIME_ZONE}`;
          for (const token of chunks(content)) send("response", { token });
          const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: content, body, assistantStatus: "complete", assistantMetadata: { source: "streams-server-clock", provider: "server-clock", providerRoute: "server-time-fast-path", providerStatus: "ok", webGrounded: false, ungroundedFallbackUsed: false, serverTimestamp, timeZone: DEFAULT_TIME_ZONE } });
          sessionId = persisted.sessionId;
          send("complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: "server-clock", providerRoute: "server-time-fast-path", providerStatus: "ok", webGrounded: false, ungroundedFallbackUsed: false, serverTimestamp, timeZone: DEFAULT_TIME_ZONE, elapsedMs: Date.now() - startedAt });
          return;
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY is required");
        const history = await getHistoryForPrompt(scope, sessionId, userContent);
        const attachmentContext = await buildAttachmentContext(scope, body, sessionId, send);
        const historyText = history.slice(-MAX_HISTORY_MESSAGES).map((m: any) => `${m.role}: ${String(m.content || "")}`).join("\n");
        const fullText = [historyText, attachmentContext.text, `Server request timestamp: ${serverTimestamp}`, `User request:\n${userContent}`].filter(Boolean).join("\n\n");
        const failures: string[] = [];
        let model = "";
        let content = "";
        for (const candidate of modelList()) {
          try {
            model = candidate;
            content = await callOpenAI({ apiKey, model, text: fullText, send, sessionId, serverTimestamp });
            break;
          } catch (e) {
            failures.push(`${candidate}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        if (!content) throw new Error(failures.join(" | ") || "No OpenAI Responses model completed.");
        for (const token of chunks(content)) send("response", { token });
        const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent: content, body, assistantStatus: "complete", assistantMetadata: { source: SOURCE, provider: "openai", providerRoute: "openai-responses", providerStatus: "ok", model, webGrounded: true, ungroundedFallbackUsed: false, providerGenerated: true, serverTimestamp } });
        sessionId = persisted.sessionId;
        send("complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, provider: "openai", providerRoute: "openai-responses", providerStatus: "ok", model, webGrounded: true, ungroundedFallbackUsed: false, serverTimestamp, elapsedMs: Date.now() - startedAt });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        const message = `Live OpenAI Responses failed. No ungrounded answer path was used. Detail: ${detail}`;
        for (const token of chunks(message)) send("response", { token });
        send("complete", { ok: false, sessionId, provider: "openai", providerRoute: "openai-responses", providerStatus: "failed", webGrounded: false, ungroundedFallbackUsed: false, error: detail, serverTimestamp, elapsedMs: Date.now() - startedAt });
      } finally {
        controller.close();
      }
    }}));
  } catch (error) {
    return streamsAIError(error);
  }
}
