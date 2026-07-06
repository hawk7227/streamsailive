import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { buildCanonicalCapabilityAnswer, buildRuntimeCapabilityRegistry, isCanonicalCapabilityQuestion } from "@/lib/streams-ai/capabilities/canonical-capabilities";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { createStreamsAIServiceClient } from "@/lib/streams-ai/server";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const assets = new StreamsAIAssetsRepository();

const LIVE_ASSISTANT_SOURCE = "streams-ai-openai-direct-stream";
const CAPABILITY_SOURCE = "streams-ai-canonical-capability-registry";
const SIMPLE_GREETING_SOURCE = "streams-ai-simple-greeting-fast-path";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_PRO_MODEL = "gpt-4o";
const MAX_HISTORY_MESSAGES = 16;
const MAX_ATTACHMENT_CONTEXT_CHARS = 36000;

type StreamSend = (event: string, payload: Record<string, unknown>) => void;
type PersistedChatMessage = { id?: string; role?: string | null; content?: string | null; metadata?: Record<string, any> | null };
type ChatPostBody = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type AttachmentContext = { text: string; imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[]; statusText: string };

const SYSTEM_PROMPT_BASE = [
  "You are Streams AI, a provider-agnostic AI business operator inside Streams.",
  "StreamsAI owns the behavior contract. OpenAI is only one possible provider that can execute this behavior.",
  "Answer immediately and naturally for normal conversation.",
  "When uploaded file context is supplied in the prompt, treat it as readable attached-file content. Review, summarize, compare, extract, and answer from that context. Do not say you cannot access the file when file context is present.",
  "When uploaded image attachments are supplied as vision inputs, inspect the image directly and answer from what is visible. Do not say the image has no readable text unless the user specifically asks for OCR and no text is visible.",
  "If an attachment is present but no readable text/context or vision input is supplied, be specific: explain that the file was attached but readable extraction is missing or still processing, and ask the user to retry or paste the content. Do not pretend to have read unavailable content.",
  "Do not pretend to have run tools, builds, deployments, file edits, searches, or generations unless the real system returns proof.",
  "When the user asks for a build, code change, repo action, generated media, file work, or proof-sensitive action, be direct about what needs a real tool/runtime path.",
  "Keep responses useful, concise, and oriented around helping the user build, create, launch, or fix the next thing.",
  "StreamsAI markdown behavior: render markdown only when it improves scanning; use bold status labels, short paragraphs, tight bullets, inline code for exact technical references, fenced code blocks only for copy/paste code or commands, and markdown tables only when comparison is clearer than bullets.",
  "StreamsAI markdown visual contract: default assistant markdown is compact builder-console text using Inter / SF Pro Display / Nunito Sans / system-ui, about 13px, 1.42 line-height, 600 weight, #f8fafc text, and -0.01em letter spacing.",
  "StreamsAI bold text contract: bold labels render at 800 weight and #ffffff. Emphasis uses #c4b5fd with normal style.",
  "StreamsAI heading contract: headings are compact, not article-sized by default. h1 is about 16px, h2 15px, h3 14px, all 800 weight, #ffffff, 1.24 line-height, with tight margins.",
  "StreamsAI inline code contract: inline code is purple-tinted, using ui-monospace/SFMono/Menlo/Consolas, about 0.92em, 700 weight, #d8b4fe text, rgba(124,58,237,.18) background, rgba(168,85,247,.28) border, 6px radius, and 1px 5px padding.",
  "StreamsAI code block contract: fenced code blocks render as compact dark cards with language labels and copy controls. Use #020617 background, rgba(148,163,184,.18) border, 12px radius, 10px code padding, 12px monospace text, #e5e7eb code color, 1.5 line-height, and horizontal scrolling.",
  "StreamsAI code header contract: code headers are 30px tall, rgba(15,23,42,.88) background, rgba(148,163,184,.16) bottom border, rgba(238,246,255,.76) label color, 11px uppercase label, 700 weight, .04em letter spacing, with a compact copy button.",
  "StreamsAI table contract: tables are compact, 12px text, 1.4 line-height, rgba(2,6,23,.44) background, rgba(148,163,184,.18) border, 12px radius, and horizontal scrolling.",
  "StreamsAI streaming contract: preserve markdown structure while tokens stream; do not expand compact replies into article formatting unless the user asks for a full breakdown, document, specification, report, or detailed explanation.",
  "Large article-style markdown is an explicit mode only for full breakdowns, docs, specs, reports, research summaries, or detailed explanations. Otherwise stay in compact builder-console mode.",
].join("\n");

function buildSystemPrompt(scope: StreamsAIScope) {
  const firstName = String(scope.userFirstName || "").trim();
  if (!firstName) return `${SYSTEM_PROMPT_BASE}\nNo reliable first name is available for this account. Do not invent one.`;
  return [
    SYSTEM_PROMPT_BASE,
    `The signed-in Streams account holder's first name is ${firstName}.`,
    `Use ${firstName} at key personal moments such as a new greeting, the first reply to hello or hi, major confirmations, important corrections, and friendly error states.`,
    `Do not use ${firstName} in every reply or for tiny status replies.`,
  ].join("\n");
}

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<ChatPostBody>(request);
    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);

    if (isAuthPresent(request) && body.runAssistant !== false && isSimpleGreetingPrompt(content)) {
      return streamSimpleGreetingResponse({ request, sessionId: body.sessionId || "", userContent: content, body });
    }

    const scope = await requireStreamsAIScope(request);

    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", content);
      const userMessage = await messages.create(scope, { sessionId, role: body.role || "user", content, status: body.status || "complete", metadata: buildUserMetadata(body) });
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }

    if (isCanonicalCapabilityQuestion(content)) return streamCanonicalCapabilityResponse({ scope, sessionId: body.sessionId || "", userContent: content, body });
    return streamDirectOpenAIResponse({ scope, sessionId: body.sessionId || "", userContent: content, mode: body.mode, body });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamSimpleGreetingResponse({ request, sessionId, userContent, body }: { request: NextRequest; sessionId: string; userContent: string; body: ChatPostBody }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const assistantContent = "Hey — I’m here. What are we building or fixing next?";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      let persistedSessionId = sessionId;
      try {
        send("activity", { phase: "simple-greeting.started", statusText: "Writing…", source: SIMPLE_GREETING_SOURCE, startedAt, sessionId: persistedSessionId });
        send("response", { token: assistantContent });
        try {
          const scope = await requireStreamsAIScope(request);
          const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: SIMPLE_GREETING_SOURCE, provider: "streams", providerStatus: "ok", fastPath: "simple-greeting" } });
          persistedSessionId = persisted.sessionId;
          send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", source: SIMPLE_GREETING_SOURCE, elapsedMs: Date.now() - startedAt });
        } catch (persistError) {
          send("complete", { ok: true, sessionId: persistedSessionId, provider: "streams", providerStatus: "not_persisted", source: SIMPLE_GREETING_SOURCE, elapsedMs: Date.now() - startedAt, persistError: persistError instanceof Error ? persistError.message : String(persistError) });
        }
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}

function streamCanonicalCapabilityResponse({ scope, sessionId, userContent, body }: { scope: StreamsAIScope; sessionId: string; userContent: string; body: ChatPostBody }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      let persistedSessionId = sessionId;
      try {
        send("activity", { phase: "capabilities.started", statusText: "Writing…", source: CAPABILITY_SOURCE, startedAt, sessionId: persistedSessionId });
        for (const token of chunkText(answer, 120)) send("response", { token });
        const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent: answer, body, assistantStatus: "complete", assistantMetadata: { source: CAPABILITY_SOURCE, provider: "streams", providerStatus: "ok", registryVersion: registry.version, capabilityCount: registry.total, statusCounts: registry.statusCounts } });
        persistedSessionId = persisted.sessionId;
        send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "streams", providerStatus: "ok", source: CAPABILITY_SOURCE, elapsedMs: Date.now() - startedAt });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}

function streamDirectOpenAIResponse({ scope, sessionId, userContent, mode, body }: { scope: StreamsAIScope; sessionId: string; userContent: string; mode?: string; body: ChatPostBody }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      let assistantContent = "";
      const model = resolveModel(mode);
      let persistedSessionId = sessionId;
      try {
        send("activity", { phase: "openai.started", statusText: "Writing…", model, source: LIVE_ASSISTANT_SOURCE, startedAt, sessionId: persistedSessionId });
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          assistantContent = "Streams AI received your message, but the real OpenAI assistant is not enabled because OPENAI_API_KEY is not configured in this deployment.";
          for (const token of chunkText(assistantContent, 90)) send("response", { token });
        } else {
          const client = new OpenAI({ apiKey });
          const history = await getHistoryForPrompt(scope, persistedSessionId, userContent);
          if (body.attachments?.length) send("activity", { phase: "attachments.reading", statusText: body.attachments.length === 1 ? "Reading attached file…" : `Reading ${body.attachments.length} attached files…`, source: LIVE_ASSISTANT_SOURCE, sessionId: persistedSessionId });
          const attachmentContext = await buildAttachmentContext(scope, body, persistedSessionId);
          if (attachmentContext.statusText) send("activity", { phase: "attachments.ready", statusText: attachmentContext.statusText, source: LIVE_ASSISTANT_SOURCE, sessionId: persistedSessionId });
          const openaiMessages = buildChatMessages(history, userContent, scope, attachmentContext);
          const openaiStream = await client.chat.completions.create({ model, messages: openaiMessages, stream: true, temperature: 0.7 });
          for await (const part of openaiStream) {
            const token = part.choices?.[0]?.delta?.content || "";
            if (!token) continue;
            assistantContent += token;
            send("response", { token });
          }
        }
        if (!assistantContent.trim()) {
          assistantContent = "I’m here. Send that again and I’ll respond from the live assistant.";
          send("response", { token: assistantContent });
        }
        const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent, body, assistantStatus: "complete", assistantMetadata: { source: LIVE_ASSISTANT_SOURCE, provider: "openai", providerStatus: apiProviderStatus(), openaiModel: model, runtimeContract: "streams_provider_markdown_contract_v1", fileContextUsed: Boolean(body.attachments?.length) } });
        persistedSessionId = persisted.sessionId;
        send("complete", { ok: true, sessionId: persistedSessionId, assistantMessageId: persisted.assistantMessageId, provider: "openai", providerStatus: apiProviderStatus(), model, elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown provider failure");
        assistantContent = `The real provider response did not complete successfully.\n\nProvider error: ${message}`;
        try {
          const persisted = await persistChatTurn({ scope, sessionId: persistedSessionId, userContent, assistantContent, body, assistantStatus: "error", assistantMetadata: { source: LIVE_ASSISTANT_SOURCE, provider: "openai", providerStatus: "failed", providerError: message, openaiModel: model } });
          persistedSessionId = persisted.sessionId;
        } catch {}
        for (const token of chunkText(assistantContent, 90)) send("response", { token });
        send("complete", { ok: true, sessionId: persistedSessionId, provider: "openai", providerStatus: "failed", model, elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}

async function getHistoryForPrompt(scope: StreamsAIScope, sessionId: string, userContent: string) {
  if (!sessionId) return [] as PersistedChatMessage[];
  if (isFastStandalonePrompt(userContent)) return [] as PersistedChatMessage[];
  return messages.list(scope, sessionId).catch(() => [] as PersistedChatMessage[]);
}

function isSimpleGreetingPrompt(content: string) {
  const text = content.trim().toLowerCase();
  return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)[.!?\s]*$/.test(text);
}
function isFastStandalonePrompt(content: string) {
  const text = content.trim().toLowerCase();
  return /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|yes|no|cool|great|good morning|good afternoon|good evening)[.!?\s]*$/.test(text);
}
function isAuthPresent(request: NextRequest) {
  const authorization = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (/^Bearer\s+\S+/i.test(authorization)) return true;
  const cookie = request.headers.get("cookie") || "";
  return /(?:^|;\s*)access_token=/.test(cookie) || /sb-[^=;]*-auth-token/.test(cookie);
}
async function ensureSession(scope: StreamsAIScope, sessionId: string, content: string) {
  if (sessionId) return sessionId;
  const created = await sessions.create(scope, { title: buildFastTitle(content), metadata: { source: "streams-ai-chat-ui", assistantRuntime: LIVE_ASSISTANT_SOURCE, mode: "direct-openai-stream", recentChat: true } });
  return created.id;
}
async function persistChatTurn({ scope, sessionId, userContent, assistantContent, body, assistantStatus, assistantMetadata }: { scope: StreamsAIScope; sessionId: string; userContent: string; assistantContent: string; body: ChatPostBody; assistantStatus: string; assistantMetadata: Record<string, unknown> }) {
  const persistedSessionId = await ensureSession(scope, sessionId, userContent);
  await messages.create(scope, { sessionId: persistedSessionId, role: body.role || "user", content: userContent, status: body.status || "complete", metadata: buildUserMetadata(body) });
  const assistantMessage = await messages.create(scope, { sessionId: persistedSessionId, role: "assistant", content: assistantContent, status: assistantStatus, metadata: assistantMetadata });
  return { sessionId: persistedSessionId, assistantMessageId: assistantMessage.id };
}
function buildUserMetadata(body: ChatPostBody) {
  return { ...(body.metadata || {}), copiedUiUserId: body.userId || null, assistantRuntime: LIVE_ASSISTANT_SOURCE, mode: "direct-openai-stream", attachments: body.attachments || [] };
}

async function buildAttachmentContext(scope: StreamsAIScope, body: ChatPostBody, sessionId: string): Promise<AttachmentContext> {
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!attachments.length) return { text: "", imageParts: [], statusText: "" };
  const assetRows = sessionId ? await assets.list(scope, { sessionId }).catch(() => []) : [];
  const byId = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const row of assetRows as any[]) {
    if (row?.id) byId.set(String(row.id), row);
    if (row?.name) byName.set(String(row.name), row);
  }
  let used = 0;
  let imageCount = 0;
  let readableCount = 0;
  let pendingCount = 0;
  const sections: string[] = [];
  const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[] = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const input = attachments[index] || {};
    const row = byId.get(String(input.id || input.assetId || "")) || byName.get(String(input.name || "")) || null;
    const merged = { ...(row || {}), ...(input || {}), metadata: { ...(row?.metadata || {}), ...(input?.metadata || {}) } };
    const metadata = merged.metadata || {};
    const textPreview = String(merged.textPreview || metadata.textPreview || input.textPreview || "").trim();
    const summary = String(merged.summary || metadata.summary || input.summary || "").trim();
    const extractionStatus = String(merged.extractionStatus || metadata.extractionStatus || metadata.processingStatus || input.extractionStatus || "unknown");
    const name = String(merged.name || input.name || `Attachment ${index + 1}`);
    const mime = String(merged.mimeType || merged.mime_type || input.mimeType || "unknown");
    const size = Number(merged.sizeBytes || merged.size_bytes || input.sizeBytes || 0);
    const isImage = String(merged.kind || input.kind || "").toLowerCase() === "image" || mime.startsWith("image/");
    const signedImageUrl = isImage ? await resolveImageUrl(merged).catch(() => "") : "";
    if (signedImageUrl) {
      imageParts.push({ type: "image_url", image_url: { url: signedImageUrl } });
      imageCount += 1;
    }
    const readable = [summary ? `Summary: ${summary}` : "", textPreview ? `Extracted text preview:\n${textPreview}` : ""].filter(Boolean).join("\n\n");
    if (readable) readableCount += 1;
    if (!readable && !signedImageUrl) pendingCount += 1;
    const statusLine = signedImageUrl ? "vision_input_available" : readable ? "readable_context_available" : `no_readable_text_available_status_${extractionStatus}`;
    let block = [`File ${index + 1}: ${name}`, `MIME: ${mime}`, `Size bytes: ${size}`, `Extraction status: ${statusLine}`].join("\n");
    if (signedImageUrl) block += "\n\nImage is attached as a vision input for direct visual review.";
    block += readable ? `\n\n${readable}` : signedImageUrl ? "" : "\n\nNo extracted text was available for this file in the backend asset metadata at request time.";
    const remaining = MAX_ATTACHMENT_CONTEXT_CHARS - used;
    if (remaining <= 0) break;
    if (block.length > remaining) block = `${block.slice(0, remaining)}\n[Attachment context truncated]`;
    used += block.length;
    sections.push(block);
  }
  const statusText = imageCount ? `Inspecting ${imageCount} image${imageCount === 1 ? "" : "s"}…` : readableCount ? `Reading ${readableCount} extracted file${readableCount === 1 ? "" : "s"}…` : pendingCount ? `Checking ${pendingCount} attachment${pendingCount === 1 ? "" : "s"}…` : "";
  return {
    text: sections.length ? `[Attached file context supplied by Streams backend]\n${sections.join("\n\n---\n\n")}\n[/Attached file context]\n\nUse the attached file context above when answering. If readable_context_available or vision_input_available is present, do not say you cannot access the file.` : "",
    imageParts,
    statusText,
  };
}

function absoluteHttpUrl(value: unknown) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}
async function resolveImageUrl(asset: any) {
  const mime = String(asset.mimeType || asset.mime_type || "");
  if (!mime.startsWith("image/")) return "";
  const bucket = asset.storageBucket || asset.storage_bucket || "";
  const path = asset.storagePath || asset.storage_path || "";
  if (bucket && path) {
    const { data, error } = await createStreamsAIServiceClient().storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return absoluteHttpUrl(asset.publicUrl || asset.public_url || asset.url);
}

function buildChatMessages(history: PersistedChatMessage[], userContent: string, scope: StreamsAIScope, attachmentContext: AttachmentContext = { text: "", imageParts: [], statusText: "" }): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: buildSystemPrompt(scope) }];
  const usable = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  for (const message of usable) {
    const content = String(message.content || "").trim();
    if (!content) continue;
    if (message.role === "assistant") result.push({ role: "assistant", content });
    else if (message.role === "user") result.push({ role: "user", content });
  }
  const text = attachmentContext.text ? `${attachmentContext.text}\n\nUser request:\n${userContent}` : userContent;
  if (attachmentContext.imageParts.length) {
    result.push({ role: "user", content: [{ type: "text", text }, ...attachmentContext.imageParts] as any });
  } else {
    result.push({ role: "user", content: text });
  }
  return result;
}
function buildFastTitle(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 58 ? `${cleaned.slice(0, 55)}…` : cleaned;
}
function resolveModel(mode?: string) {
  if (mode === "Pro") return process.env.OPENAI_PRO_MODEL || DEFAULT_PRO_MODEL;
  return process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || DEFAULT_FAST_MODEL;
}
function apiProviderStatus() { return process.env.OPENAI_API_KEY ? "ok" : "not_configured"; }
function chunkText(text: string, max = 32) {
  const value = String(text || "");
  if (!value) return [];
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += max) chunks.push(value.slice(index, index + max));
  return chunks;
}
function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
