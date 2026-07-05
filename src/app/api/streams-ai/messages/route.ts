import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { buildCanonicalCapabilityAnswer, buildRuntimeCapabilityRegistry, isCanonicalCapabilityQuestion } from "@/lib/streams-ai/capabilities/canonical-capabilities";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();

const LIVE_ASSISTANT_SOURCE = "streams-ai-openai-direct-stream";
const CAPABILITY_SOURCE = "streams-ai-canonical-capability-registry";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_PRO_MODEL = "gpt-4o";
const MAX_HISTORY_MESSAGES = 16;

type StreamSend = (event: string, payload: Record<string, unknown>) => void;
type PersistedChatMessage = { id?: string; role?: string | null; content?: string | null; metadata?: Record<string, any> | null };

const SYSTEM_PROMPT_BASE = [
  "You are Streams AI, a provider-agnostic AI business operator inside Streams.",
  "StreamsAI owns the behavior contract. OpenAI is only one possible provider that can execute this behavior.",
  "Answer immediately and naturally for normal conversation.",
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
    try {
      const session = await sessions.get(scope, sessionId);
      if (!session) return streamsAIJson({ ok: false, error: "Session not found" }, 404);
      const data = await messages.list(scope, sessionId);
      return streamsAIJson({ ok: true, messages: data });
    } catch (error) {
      console.warn("[streams-ai-messages] get fallback", error);
      return streamsAIJson({ ok: true, messages: [], fallback: true });
    }
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] }>(request);
    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);

    let sessionId = body.sessionId || "";
    if (!sessionId) {
      sessionId = await safeCreateSession(scope, content);
    }

    const userMessage = await safeCreateMessage(scope, {
      sessionId,
      role: body.role || "user",
      content,
      status: body.status || "complete",
      metadata: {
        ...(body.metadata || {}),
        copiedUiUserId: body.userId || null,
        assistantRuntime: LIVE_ASSISTANT_SOURCE,
        mode: "direct-openai-stream",
        attachments: body.attachments || [],
      },
    });

    if (body.runAssistant === false) return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage], fallback: userMessage.metadata?.previewFallback === true }, 201);
    if (isCanonicalCapabilityQuestion(content)) return streamCanonicalCapabilityResponse({ scope, sessionId, userContent: content });
    return streamDirectOpenAIResponse({ scope, sessionId, userContent: content, mode: body.mode });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamCanonicalCapabilityResponse({ scope, sessionId, userContent }: { scope: StreamsAIScope; sessionId: string; userContent: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      try {
        send("activity", { phase: "capabilities.started", statusText: "Loading Streams capabilities…", source: CAPABILITY_SOURCE, startedAt, sessionId });
        for (const token of chunkText(answer, 120)) send("response", { token });
        const assistantMessage = await safeCreateMessage(scope, {
          sessionId,
          role: "assistant",
          content: answer,
          status: "complete",
          metadata: { source: CAPABILITY_SOURCE, provider: "streams", providerStatus: "ok", registryVersion: registry.version, capabilityCount: registry.total, statusCounts: registry.statusCounts },
        });
        send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "streams", providerStatus: "ok", source: CAPABILITY_SOURCE, elapsedMs: Date.now() - startedAt });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}

function streamDirectOpenAIResponse({ scope, sessionId, userContent, mode }: { scope: StreamsAIScope; sessionId: string; userContent: string; mode?: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      let assistantContent = "";
      const model = resolveModel(mode);

      try {
        send("activity", { phase: "openai.started", statusText: "Writing…", model, source: LIVE_ASSISTANT_SOURCE, startedAt, sessionId });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          assistantContent = "Streams AI saved your message, but the real OpenAI assistant is not enabled because OPENAI_API_KEY is not configured in this deployment.";
          for (const token of chunkText(assistantContent, 90)) send("response", { token });
        } else {
          const client = new OpenAI({ apiKey });
          const history = await messages.list(scope, sessionId).catch(() => [] as PersistedChatMessage[]);
          const openaiMessages = buildChatMessages(history, userContent, scope);
          const openaiStream = await client.chat.completions.create({
            model,
            messages: openaiMessages,
            stream: true,
            temperature: 0.7,
          });

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

        const assistantMessage = await safeCreateMessage(scope, {
          sessionId,
          role: "assistant",
          content: assistantContent,
          status: "complete",
          metadata: {
            source: LIVE_ASSISTANT_SOURCE,
            provider: "openai",
            providerStatus: apiProviderStatus(),
            openaiModel: model,
            runtimeContract: "streams_provider_markdown_contract_v1",
          },
        });

        send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "openai", providerStatus: apiProviderStatus(), model, elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown provider failure");
        assistantContent = `The real provider response did not complete successfully.\n\nProvider error: ${message}`;
        await safeCreateMessage(scope, { sessionId, role: "assistant", content: assistantContent, status: "error", metadata: { source: LIVE_ASSISTANT_SOURCE, provider: "openai", providerStatus: "failed", providerError: message, openaiModel: model } });
        for (const token of chunkText(assistantContent, 90)) send("response", { token });
        send("complete", { ok: true, sessionId, provider: "openai", providerStatus: "failed", model, elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}

function buildChatMessages(history: PersistedChatMessage[], userContent: string, scope: StreamsAIScope): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: buildSystemPrompt(scope) }];
  const usable = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  for (const message of usable) {
    const content = String(message.content || "").trim();
    if (!content) continue;
    if (message.role === "assistant") result.push({ role: "assistant", content });
    else if (message.role === "user") result.push({ role: "user", content });
  }
  result.push({ role: "user", content: userContent });
  return result;
}

async function safeCreateSession(scope: StreamsAIScope, content: string) {
  try {
    const created = await sessions.create(scope, {
      title: buildFastTitle(content),
      metadata: {
        source: "streams-ai-chat-ui",
        assistantRuntime: LIVE_ASSISTANT_SOURCE,
        mode: "direct-openai-stream",
        recentChat: true,
      },
    });
    return String(created.id);
  } catch (error) {
    console.warn("[streams-ai-messages] create session fallback", error);
    return `preview_session_${Date.now()}`;
  }
}

async function safeCreateMessage(scope: StreamsAIScope, input: { sessionId: string; role: "user" | "assistant" | "system" | "tool"; content?: string; status?: string; metadata?: Record<string, any> }) {
  try {
    return await messages.create(scope, input);
  } catch (error) {
    console.warn("[streams-ai-messages] create message fallback", error);
    return {
      id: `preview_message_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: scope.defaultProjectId,
      session_id: input.sessionId,
      role: input.role,
      content: input.content || "",
      status: input.status || "complete",
      metadata: { ...(input.metadata || {}), previewFallback: true },
      created_at: new Date().toISOString(),
    };
  }
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

function apiProviderStatus() {
  return process.env.OPENAI_API_KEY ? "ok" : "not_configured";
}

function chunkText(text: string, max = 32) {
  const value = String(text || "");
  if (!value) return [];
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += max) chunks.push(value.slice(index, index + max));
  return chunks;
}

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
