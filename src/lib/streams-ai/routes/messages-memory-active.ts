import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import { buildStreamsParitySystemPrompt, STREAMS_PARITY_PROFILE_VERSION } from "../intelligence/parity-profile";
import { prepareAuthoritativeStreamsTurn, buildAuthoritativeTurnPrompt } from "../runtime/authoritative-turn-controller";
import { judgeStreamsResponse } from "../quality/semantic-judge";
import { buildAttachmentContext, buildUserMetadata, ensureSession, getHistoryForPrompt, persistChatTurn, resolveIdempotencyBase, resolveTurnId } from "./messages-memory-provider-support";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const SOURCE = "streams-ai-responses-live";
const DEFAULT_TIME_ZONE = "America/Phoenix";
const DEFAULT_TIME_ZONE_LABEL = "MST";
const ATTACHMENT_ONLY_SENTINEL = "\u200B";

type Body = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, any>; runAssistant?: boolean; userId?: string; idempotencyKey?: string; turnId?: string; mode?: string; provider?: string; attachments?: any[] };
type Send = (event: string, payload: Record<string, unknown>) => void;

function sse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function chunks(text: string, size = 180) {
  const out: string[] = [];
  for (let i = 0; i < String(text || "").length; i += size) out.push(String(text || "").slice(i, i + size));
  return out.length ? out : [""];
}

function streamExistingMessage(message: any) {
  return sse(new ReadableStream<Uint8Array>({
    start(controller) {
      emit(controller, "activity", { phase: "complete", statusText: "Ready", sessionId: message.session_id });
      for (const token of chunks(String(message.content || ""))) emit(controller, "response", { token });
      emit(controller, "complete", {
        ok: true,
        sessionId: message.session_id,
        assistantMessageId: message.id,
        duplicatePrevented: true,
        idempotencyKey: message.idempotency_key || null,
      });
      controller.close();
    },
  }));
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

function parseProviderSSE(buffer: string) {
  const events: Array<{ eventName: string; payload: any }> = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  for (const part of parts) {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const rawLine of part.split("\n")) {
      const line = rawLine.trimEnd();
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    const dataRaw = dataLines.join("\n");
    if (!dataRaw || dataRaw === "[DONE]") continue;
    try {
      const payload = JSON.parse(dataRaw);
      events.push({ eventName: payload?.type || eventName, payload });
    } catch {
      events.push({ eventName, payload: { data: dataRaw } });
    }
  }
  return { events, rest };
}

async function callResponsesStream(input: { apiKey: string; model: string; text: string; imageUrls: string[]; send: Send; sessionId: string; systemText: string }) {
  input.send("activity", {
    phase: "preparing",
    statusText: input.imageUrls.length ? "Checking the reference image…" : "Understanding your request…",
    source: SOURCE,
    sessionId: input.sessionId,
  });

  const userContent: Array<Record<string, unknown>> = [{ type: "input_text", text: input.text }];
  for (const imageUrl of input.imageUrls) userContent.push({ type: "input_image", image_url: imageUrl, detail: "high" });

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: input.model,
      stream: true,
      input: [
        { role: "system", content: input.systemText },
        { role: "user", content: userContent },
      ],
      tools: [{ type: "web_search_preview" }],
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message || json?.message || `Responses request failed: ${res.status}`);
  }
  if (!res.body) throw new Error("Streaming response body was unavailable");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let writingStarted = false;
  let citationCount = 0;
  let webSearchUsed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseProviderSSE(buffer);
    buffer = parsed.rest;

    for (const { eventName, payload } of parsed.events) {
      if (eventName === "response.output_text.delta") {
        const delta = String(payload?.delta || "");
        if (delta) {
          if (!writingStarted) {
            writingStarted = true;
            input.send("activity", { phase: "streaming", statusText: "Writing…", source: SOURCE, sessionId: input.sessionId });
          }
          content += delta;
          input.send("response", { token: delta });
        }
      } else if (eventName === "response.web_search_call.in_progress" || eventName === "response.web_search_call.searching") {
        webSearchUsed = true;
        input.send("activity", { phase: "running", statusText: "Searching the web…", source: SOURCE, sessionId: input.sessionId });
      } else if (eventName === "response.web_search_call.completed") {
        webSearchUsed = true;
        input.send("activity", { phase: "running", statusText: "Reviewing sources…", source: SOURCE, sessionId: input.sessionId });
      } else if (/citation/i.test(eventName)) {
        citationCount += 1;
      } else if (eventName === "error" || eventName === "response.failed") {
        throw new Error(payload?.error?.message || payload?.message || "The response stream failed");
      }
    }
  }

  if (!content.trim()) throw new Error("The response completed without text output");
  return { content, citationCount, webSearchUsed };
}

async function verifyAssistantOnlyRequest(scope: any, body: Body, requestedContent: string) {
  if (body.metadata?.skipUserPersistence !== true) return { content: requestedContent, attachments: body.attachments || [] };
  const sessionId = String(body.sessionId || "").trim();
  const sourceUserMessageId = String(body.metadata?.sourceUserMessageId || "").trim();
  const regeneratedFromMessageId = String(body.metadata?.regeneratedFromMessageId || "").trim();
  if (!sessionId || !sourceUserMessageId || !regeneratedFromMessageId) {
    throw new Error("Assistant-only execution requires verified source message identifiers.");
  }

  const rows = await messages.list(scope, sessionId);
  const userIndex = rows.findIndex((row: any) => String(row.id) === sourceUserMessageId && row.role === "user");
  const assistantIndex = rows.findIndex((row: any) => String(row.id) === regeneratedFromMessageId && row.role === "assistant");
  if (userIndex < 0 || assistantIndex < 0 || userIndex >= assistantIndex) {
    throw new Error("Assistant-only execution source messages are invalid.");
  }
  const sourceUser = rows[userIndex];
  const content = String(sourceUser.content || "").trim();
  if (!content || content !== requestedContent.trim()) {
    throw new Error("Assistant-only execution content does not match the verified source request.");
  }
  return {
    content,
    attachments: Array.isArray(sourceUser?.metadata?.attachments) ? sourceUser.metadata.attachments : [],
  };
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
    const rawUserContent = body.content || body.message || "";
    let userContent = rawUserContent.trim();
    if (!userContent) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);

    const scope = await requireStreamsAIScope(request);
    const verified = await verifyAssistantOnlyRequest(scope, body, userContent);
    userContent = verified.content;
    body.content = userContent;
    body.message = userContent;
    body.attachments = verified.attachments;

    const effectiveInstruction = userContent === ATTACHMENT_ONLY_SENTINEL
      ? `Review the attached file${Array.isArray(body.attachments) && body.attachments.length === 1 ? "" : "s"}.`
      : userContent;
    const idempotencyBase = resolveIdempotencyBase(body);
    const turnId = resolveTurnId(body);

    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", userContent);
      const role = body.role || "user";
      const message = await messages.create(scope, {
        sessionId,
        role,
        content: userContent,
        status: body.status || "complete",
        metadata: { ...buildUserMetadata(body), turnId },
        turnId,
        idempotencyKey: idempotencyBase ? `${idempotencyBase}:${role}` : null,
      });
      return streamsAIJson({ ok: true, sessionId, message, messages: [message] }, 201);
    }

    if (idempotencyBase) {
      const existingAssistant = await messages.findByIdempotencyKey(scope, `${idempotencyBase}:assistant`);
      if (existingAssistant) return streamExistingMessage(existingAssistant);
    }

    const normalizedBody: Body = { ...body, turnId, idempotencyKey: idempotencyBase || undefined };

    return sse(new ReadableStream<Uint8Array>({
      async start(controller) {
        const send: Send = (event, payload) => emit(controller, event, payload);
        const startedAt = Date.now();
        const serverTimestamp = new Date(startedAt).toISOString();
        let sessionId = normalizedBody.sessionId || "";

        try {
          send("activity", { phase: "created", statusText: "Reviewing your request…", source: "streams-server", sessionId });

          if (isTimeIntent(effectiveInstruction) && !isOpenAILiveProofIntent(effectiveInstruction)) {
            const localTime = formatLocalTime(new Date(startedAt));
            const content = `Your current time in Arizona is ${localTime} ${DEFAULT_TIME_ZONE_LABEL}.\n\nServer timestamp: ${serverTimestamp}\nTimezone: ${DEFAULT_TIME_ZONE}`;
            for (const token of chunks(content)) send("response", { token });
            const persisted = await persistChatTurn({
              scope,
              sessionId,
              userContent,
              assistantContent: content,
              body: normalizedBody,
              assistantStatus: "complete",
              assistantMetadata: { source: "streams-server-clock", provider: "server-clock", providerRoute: "server-time-fast-path", providerStatus: "ok", webGrounded: false, ungroundedFallbackUsed: false, serverTimestamp, timeZone: DEFAULT_TIME_ZONE, parityProfile: STREAMS_PARITY_PROFILE_VERSION },
            });
            sessionId = persisted.sessionId;
            send("complete", { ok: true, sessionId, assistantMessageId: persisted.assistantMessageId, turnId: persisted.turnId, serverTimestamp, elapsedMs: Date.now() - startedAt });
            return;
          }

          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error("The assistant service is not configured");

          const history = await getHistoryForPrompt(scope, sessionId, userContent);
          const attachmentContext = await buildAttachmentContext(scope, normalizedBody, sessionId, send);
          const imageUrls = attachmentContext.imageParts.map((part: any) => String(part?.image_url?.url || "")).filter(Boolean);
          const projectId = String(normalizedBody.metadata?.projectId || normalizedBody.metadata?.project_id || "").trim() || null;
          const authoritativeTurn = await prepareAuthoritativeStreamsTurn({
            scope,
            sessionId,
            projectId,
            userMessage: effectiveInstruction,
            attachments: normalizedBody.attachments || [],
            turnId,
            taskId: String(normalizedBody.metadata?.taskId || normalizedBody.metadata?.task_id || "") || null,
            requestedMode: normalizedBody.mode || null,
            recentMessages: history,
            attachmentText: attachmentContext.text,
            imageUrls,
            selectedContext: normalizedBody.metadata?.selectedContext || null,
            activeArtifact: normalizedBody.metadata?.activeArtifact || null,
            toolEvidence: Array.isArray(normalizedBody.metadata?.toolEvidence) ? normalizedBody.metadata.toolEvidence : [],
            unresolvedTaskState: normalizedBody.metadata?.unresolvedTaskState || null,
          });
          const fullText = buildAuthoritativeTurnPrompt(authoritativeTurn);
          const modelCandidates = [authoritativeTurn.modelRoute.primary.id, ...authoritativeTurn.modelRoute.fallbacks.map((model) => model.id)];
          const failures: string[] = [];
          let model = "";
          let generated: Awaited<ReturnType<typeof callResponsesStream>> | null = null;
          const systemText = buildStreamsParitySystemPrompt(serverTimestamp);

          for (const candidate of modelCandidates) {
            try {
              model = candidate;
              generated = await callResponsesStream({ apiKey, model, text: fullText, imageUrls, send, sessionId, systemText });
              break;
            } catch (error) {
              failures.push(error instanceof Error ? error.message : String(error));
            }
          }
          if (!generated?.content) throw new Error(failures.join(" | ") || "No response completed");

          send("activity", { phase: "evaluating", statusText: "Checking response quality…", source: SOURCE, sessionId });
          const judgment = judgeStreamsResponse({
            userInstruction: effectiveInstruction,
            responseText: generated.content,
            intent: authoritativeTurn.intent,
            hasImages: imageUrls.length > 0,
            hasFiles: Boolean(attachmentContext.text),
            toolEvidenceCount: authoritativeTurn.context.toolEvidence.length,
            citationCount: generated.citationCount,
          });

          send("activity", { phase: "persisting", statusText: "Saving…", source: SOURCE, sessionId });
          const persisted = await persistChatTurn({
            scope,
            sessionId,
            userContent,
            assistantContent: generated.content,
            body: normalizedBody,
            assistantStatus: "complete",
            assistantMetadata: {
              source: SOURCE,
              provider: "openai",
              providerRoute: "authoritative-openai-responses",
              providerStatus: "ok",
              model,
              imageGrounded: imageUrls.length > 0,
              imageCount: imageUrls.length,
              webGrounded: generated.webSearchUsed,
              ungroundedFallbackUsed: false,
              providerGenerated: true,
              serverTimestamp,
              regeneratedFromMessageId: normalizedBody.metadata?.regeneratedFromMessageId || null,
              parityProfile: STREAMS_PARITY_PROFILE_VERSION,
              controllerVersion: authoritativeTurn.controllerVersion,
              taskId: authoritativeTurn.taskId,
              orchestratorMode: authoritativeTurn.context.runtimeContext?.plan?.mode || authoritativeTurn.intent.primaryIntent,
              intentDecision: authoritativeTurn.intent,
              modelRouteVersion: authoritativeTurn.modelRoute.routeVersion,
              modelRouteReason: authoritativeTurn.modelRoute.reason,
              memoryCount: authoritativeTurn.context.retrievedMemory.memories.length,
              runtimeContextUsed: Boolean(authoritativeTurn.context.runtimeContext?.contextText),
              contextPackageVersion: authoritativeTurn.context.version,
              contextSnapshot: authoritativeTurn.context.snapshot,
              contextBudget: authoritativeTurn.context.tokenBudget,
              parityQuality: judgment,
            },
          });
          sessionId = persisted.sessionId;
          send("complete", {
            ok: true,
            sessionId,
            assistantMessageId: persisted.assistantMessageId,
            turnId: persisted.turnId,
            taskId: authoritativeTurn.taskId,
            imageGrounded: imageUrls.length > 0,
            imageCount: imageUrls.length,
            serverTimestamp,
            parityProfile: STREAMS_PARITY_PROFILE_VERSION,
            qualityScore: judgment.overallScore,
            qualityAccepted: judgment.accepted,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          send("error", { message: "Streams could not complete this response. Please retry.", detailCode: "STREAMS_RESPONSE_FAILED", sessionId, elapsedMs: Date.now() - startedAt });
          console.error("[streams-ai/messages] response failed", detail);
        } finally {
          controller.close();
        }
      },
    }));
  } catch (error) {
    return streamsAIError(error);
  }
}
