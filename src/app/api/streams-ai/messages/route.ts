import { NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";
import { requiresDeterministicStructureCheck } from "@/lib/streams-ai/routes/response-structure-validator";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { buildUserMetadata, ensureSession, getHistoryForPrompt, persistChatTurn, resolveIdempotencyBase, resolveTurnId } from "@/lib/streams-ai/routes/messages-memory-provider-support";
import { sanitizeStreamsAIPayload } from "@/lib/streams-ai/protected-reasoning";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { routeProductIntent } from "@/lib/streams-ai/runtime/architecture/product-intent-router";
import { StreamsOperationRepository } from "@/lib/streams-ai/runtime/architecture/operation-repository";
import { executeWebsiteBuild } from "@/lib/streams-builder/chat-builder-executor";
import { runtimeCompletionMessage } from "@/lib/streams-ai/runtime/architecture/execution-truth-validator";

export const runtime = "nodejs";
export const maxDuration = 300;

type StreamsMessageRequestBody = Record<string, any> & {
  sessionId?: string;
  content?: string;
  message?: string;
  attachments?: any[];
  idempotencyKey?: string;
  turnId?: string;
  userId?: string;
  mode?: string;
  provider?: string;
  runAssistant?: boolean;
  metadata?: Record<string, any>;
};

const messages = new StreamsAIMessagesRepository();
const operations = new StreamsOperationRepository();

const ATTACHMENT_ONLY_SENTINEL = "\u200B";
const FAST_SOURCE = "streams-ai-provider-direct";
const FAST_SYSTEM_PROMPT = [
  "You are Streams AI, a capable and direct AI assistant.",
  "Answer the user's message naturally and immediately.",
  "Do not mention internal pipelines, candidates, judges, persistence, or hidden processing.",
  "For a greeting, respond conversationally and briefly.",
].join("\n");

function normalizedRequestBody(body: StreamsMessageRequestBody): StreamsMessageRequestBody {
  const idempotencyKey = String(body.idempotencyKey || body.userId || "").trim() || crypto.randomUUID();
  const turnId = String(body.turnId || "").trim() || crypto.randomUUID();
  return sanitizeStreamsAIPayload({ ...body, idempotencyKey, turnId });
}

function explicitlyRequestsDeterministicStructure(userContent: string, body: StreamsMessageRequestBody) {
  if (body.metadata?.enforceDeterministicStructure === true) return true;
  const text = String(userContent || "");
  if (!text || text === ATTACHMENT_ONLY_SENTINEL) return false;
  return /\b(markdown\s+table|exact\s+columns?|fenced\s+code\s+block|blockquote|numbered\s+sections?|output\s+exactly|use\s+this\s+exact\s+format|return\s+only\s+(?:json|xml|csv))\b/i.test(text)
    && requiresDeterministicStructureCheck(text);
}

function shouldUseDirectProvider(body: StreamsMessageRequestBody, userContent: string) {
  if (body.runAssistant === false || !userContent) return false;
  if (body.metadata?.skipUserPersistence === true) return false;
  if (Array.isArray(body.attachments) && body.attachments.length > 0) return false;
  if (body.metadata?.enforceDeterministicStructure === true) return false;
  if (body.webSearchEnabled === true || body.metadata?.webSearchEnabled === true) return false;
  if (userContent.length > 2500) return false;

  const complexIntent = /\b(latest|today|current|news|search the web|research|sources?|citations?|upload|attached|file|image|video|audio|transcribe|analy[sz]e this link|https?:\/\/|build|deploy|github|calendar|email|send|create an image)\b/i;
  return !complexIntent.test(userContent);
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function sse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Streams-AI-Route": "provider-direct",
    },
  });
}

async function directProviderResponse(request: NextRequest, body: StreamsMessageRequestBody, userContent: string) {
  return sse(new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let sessionId = String(body.sessionId || "").trim();
      let assistantContent = "";
      let providerResponseId = "";
      let userMessageId = "";
      let scope: Awaited<ReturnType<typeof requireStreamsAIScope>> | null = null;

      try {
        emit(controller, "activity", {
          phase: "generating",
          statusText: "Responding…",
          source: FAST_SOURCE,
          sessionId,
          elapsedMs: 0,
        });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("The assistant service is not configured");

        scope = await requireStreamsAIScope(request);
        sessionId = await ensureSession(scope, sessionId, userContent);
        const history = await getHistoryForPrompt(scope, sessionId, userContent);
        const turnId = resolveTurnId(body);
        const idempotencyBase = resolveIdempotencyBase(body) || turnId;
        const userMessage = await messages.create(scope, {
          sessionId, role: "user", content: userContent, status: "complete",
          metadata: { ...buildUserMetadata(body), turnId, executionPrePersisted: true },
          turnId, idempotencyKey: `${idempotencyBase}:user`,
        });
        userMessageId = userMessage.id;
        const model = String(process.env.STREAMS_FAST_CHAT_MODEL || "gpt-4o-mini").trim();
        const providerInput = [
          { role: "system", content: FAST_SYSTEM_PROMPT },
          ...history.slice(-12).map((message: any) => ({ role: message.role === "assistant" ? "assistant" : "user", content: String(message.content || "") })),
          { role: "user", content: userContent },
        ];

        const provider = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          signal: request.signal,
          body: JSON.stringify({
            model,
            stream: true,
            input: providerInput,
          }),
        });

        if (!provider.ok || !provider.body) {
          const errorText = await provider.text().catch(() => "");
          throw new Error(errorText || `Provider request failed: ${provider.status}`);
        }

        const reader = provider.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");

            const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            const raw = dataLine.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;

            const event = JSON.parse(raw);
            if (event.type === "response.created") providerResponseId = String(event.response?.id || "");
            if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
              assistantContent += event.delta;
              emit(controller, "response", { token: event.delta });
            }
          }
        }

        assistantContent = assistantContent.trim();
        if (!assistantContent) throw new Error("The provider completed without text output");

        let persisted: any = null;
        let persistenceDegraded = false;
        try {
          persisted = await persistChatTurn({
            scope,
            sessionId,
            userContent,
            assistantContent,
            body: { ...body, metadata: { ...(body.metadata || {}), skipUserPersistence: true, sourceUserMessageId: userMessageId, executionPrePersisted: true } },
            assistantStatus: "complete",
            assistantMetadata: {
              source: FAST_SOURCE,
              providerStatus: "ok",
              providerResponseId: providerResponseId || null,
              providerModel: model,
              firstResponseTargetMs: 2000,
              elapsedToProviderCompleteMs: Date.now() - startedAt,
            },
          });
        } catch (persistenceError) {
          persistenceDegraded = true;
          console.error("STREAMS_FAST_CHAT_PERSISTENCE_FAILED", persistenceError);
        }

        emit(controller, "complete", {
          ok: true,
          sessionId,
          assistantMessageId: persisted?.assistantMessageId || `direct_${crypto.randomUUID()}`,
          turnId: persisted?.turnId || body.turnId,
          providerResponseId: providerResponseId || null,
          source: FAST_SOURCE,
          persistenceDegraded,
          elapsedMs: Date.now() - startedAt,
        });
        controller.close();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const cancelled = request.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
        if (scope && userMessageId) {
          try {
            const turnId = resolveTurnId(body);
            const idempotencyBase = resolveIdempotencyBase(body) || turnId;
            await messages.create(scope, {
              sessionId, role: "assistant", content: cancelled ? "Streams stopped this response." : "Streams could not complete this response. Your message was preserved.", status: cancelled ? "cancelled" : "failed",
              metadata: { source: FAST_SOURCE, detailCode: cancelled ? "STREAMS_RESPONSE_CANCELLED" : "STREAMS_PROVIDER_DIRECT_FAILED", detail, sourceUserMessageId: userMessageId },
              turnId, idempotencyKey: `${idempotencyBase}:assistant`,
            });
          } catch (persistenceError) { console.error("STREAMS_FAST_CHAT_FAILURE_PERSISTENCE_FAILED", persistenceError); }
        }
        emit(controller, "error", {
          message: cancelled ? "Streams stopped this response." : "Streams could not complete this response. Please retry.",
          detail,
          detailCode: cancelled ? "STREAMS_RESPONSE_CANCELLED" : "STREAMS_PROVIDER_DIRECT_FAILED",
          sessionId,
          elapsedMs: Date.now() - startedAt,
        });
        controller.close();
      }
    },
  }));
}


async function builderResponse(request: NextRequest, body: StreamsMessageRequestBody, userContent: string) {
  return sse(new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let sessionId = String(body.sessionId || "").trim();
      const turnId = resolveTurnId(body);
      const idempotencyBase = resolveIdempotencyBase(body) || `${turnId}:website`;
      let userMessageId = "";
      try {
        const scope = await requireStreamsAIScope(request);
        sessionId = await ensureSession(scope, sessionId, userContent);
        const latest = await operations.latest(scope, sessionId).catch(() => null);
        const route = routeProductIntent(userContent, { hasFailedOperation: latest?.status === "failed", hasActivePreview: Boolean(latest?.previewUrl) });

        const userMessage = await messages.create(scope, {
          sessionId,
          role: "user",
          content: userContent,
          status: "complete",
          metadata: { ...buildUserMetadata(body), turnId, productIntent: route.intent, executionPrePersisted: true },
          turnId,
          idempotencyKey: `${idempotencyBase}:user`,
        });
        userMessageId = userMessage.id;

        if (route.intent === "OPEN_PREVIEW" || route.intent === "EXPLAIN_FAILURE" || route.intent === "CANCEL_OPERATION") {
          let assistantContent = "";
          let operation = latest;
          if (route.intent === "OPEN_PREVIEW") {
            assistantContent = latest?.previewUrl ? `Opening the saved frontend preview: ${latest.previewUrl}` : "There is no verified frontend preview in this conversation yet.";
          } else if (route.intent === "EXPLAIN_FAILURE") {
            assistantContent = latest?.failure?.safeMessage || (latest ? `The last operation is ${latest.status} at stage ${latest.stage}.` : "No prior operation was recorded for this conversation.");
          } else {
            if (latest && ["queued", "running"].includes(latest.status)) operation = await operations.transition(scope, latest.operationId, "CANCELLED", { status: "cancelled" });
            assistantContent = operation?.status === "cancelled" ? "The active operation was cancelled. Completed artifacts were preserved." : "There is no active operation to cancel.";
          }
          const persisted = await persistChatTurn({ scope, sessionId, userContent, assistantContent, body: { ...body, turnId, idempotencyKey: idempotencyBase, metadata: { ...(body.metadata || {}), skipUserPersistence: true, sourceUserMessageId: userMessageId, executionPrePersisted: true } }, assistantStatus: "complete", assistantMetadata: { source: "streams-ai-command-runtime", operationId: operation?.operationId || null, previewId: operation?.previewId || null, previewUrl: operation?.previewUrl || null, executionVerified: true } });
          emit(controller, "response", { token: assistantContent });
          if (route.intent === "OPEN_PREVIEW" && operation?.previewUrl) emit(controller, "artifact", { operationId: operation.operationId, previewId: operation.previewId, previewUrl: operation.previewUrl, artifacts: operation.artifacts, action: "open_preview" });
          emit(controller, "complete", { ok: true, sessionId, turnId, assistantMessageId: persisted.assistantMessageId, operationId: operation?.operationId || null, previewId: operation?.previewId || null, previewUrl: operation?.previewUrl || null, source: "streams-ai-command-runtime", elapsedMs: Date.now() - startedAt });
          return;
        }

        const operation = await executeWebsiteBuild({
          scope,
          sessionId,
          turnId,
          userMessage: route.intent === "RETRY_LAST_OPERATION" ? String(latest?.metadata?.userMessage || userContent) : userContent,
          idempotencyKey: `${idempotencyBase}:operation`,
          route,
          projectId: String(body.metadata?.projectId || body.metadata?.project_id || scope.defaultProjectId || "") || null,
          parentOperationId: route.intent === "RETRY_LAST_OPERATION" ? latest?.operationId || null : null,
          signal: request.signal,
          emit: (phase, statusText, data = {}) => emit(controller, "activity", { phase, statusText, source: "streams-ai-builder-runtime", sessionId, turnId, ...data }),
        });
        const assistantContent = runtimeCompletionMessage(operation);
        const persisted = await persistChatTurn({
          scope,
          sessionId,
          userContent,
          assistantContent,
          body: {
            ...body,
            turnId,
            idempotencyKey: idempotencyBase,
            metadata: { ...(body.metadata || {}), skipUserPersistence: true, sourceUserMessageId: userMessageId, executionPrePersisted: true },
          },
          assistantStatus: "complete",
          assistantMetadata: {
            source: "streams-ai-builder-runtime",
            operationId: operation.operationId,
            projectId: operation.projectId || null,
            previewId: operation.previewId || null,
            previewUrl: operation.previewUrl || null,
            artifacts: operation.artifacts,
            executionVerified: true,
          },
        });
        emit(controller, "response", { token: assistantContent });
        emit(controller, "artifact", { operationId: operation.operationId, previewId: operation.previewId, previewUrl: operation.previewUrl, artifacts: operation.artifacts, action: body.metadata?.suppressAutoOpen === true ? "available" : "open_preview" });
        emit(controller, "complete", { ok: true, sessionId, turnId, assistantMessageId: persisted.assistantMessageId, operationId: operation.operationId, previewId: operation.previewId, previewUrl: operation.previewUrl, artifacts: operation.artifacts, source: "streams-ai-builder-runtime", elapsedMs: Date.now() - startedAt });
      } catch (error: any) {
        const operation = error?.operation || null;
        const safeMessage = operation?.failure?.safeMessage || "The frontend operation did not complete. Your conversation was preserved.";
        if (userMessageId) {
          try {
            const scope = await requireStreamsAIScope(request);
            await messages.create(scope, {
              sessionId,
              role: "assistant",
              content: safeMessage,
              status: "failed",
              metadata: { source: "streams-ai-builder-runtime", operationId: operation?.operationId || null, failure: operation?.failure || null, sourceUserMessageId: userMessageId, executionVerified: false },
              turnId,
              idempotencyKey: `${idempotencyBase}:assistant`,
            });
          } catch (persistenceError) {
            console.error("STREAMS_BUILDER_FAILURE_PERSISTENCE_FAILED", persistenceError);
          }
        }
        emit(controller, "error", { message: safeMessage, detailCode: operation?.failure?.code || "STREAMS_BUILDER_FAILED", sessionId, turnId, operationId: operation?.operationId || null, failure: operation?.failure || null, retryable: operation?.failure?.retryable !== false, elapsedMs: Date.now() - startedAt });
      } finally {
        controller.close();
      }
    },
  }));
}

export async function GET(request: NextRequest) {
  return memoryMessagesGET(request);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.clone().json().catch(() => ({} as StreamsMessageRequestBody));
    const body = normalizedRequestBody(rawBody as StreamsMessageRequestBody);
    const userContent = String(body.content || body.message || "").trim();
    const enforceDeterministicStructure = explicitlyRequestsDeterministicStructure(userContent, body);
    const authoritativeBody = sanitizeStreamsAIPayload({
      ...body,
      metadata: {
        ...(body.metadata || {}),
        enforceDeterministicStructure,
      },
    });

    const productRoute = routeProductIntent(userContent);
    if (productRoute.requiresBuilder || ["OPEN_PREVIEW", "RETRY_LAST_OPERATION", "EXPLAIN_FAILURE", "CANCEL_OPERATION"].includes(productRoute.intent)) {
      return builderResponse(request, authoritativeBody, userContent);
    }

    if (shouldUseDirectProvider(authoritativeBody, userContent)) {
      return directProviderResponse(request, authoritativeBody, userContent);
    }

    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    return memoryMessagesPOST(new NextRequest(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(authoritativeBody),
      signal: request.signal,
    }));
  } catch {
    return new Response("Streams could not complete this response.", { status: 500 });
  }
}
