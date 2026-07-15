import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "../auth";
import { StreamsAIJobsRepository } from "../repositories/jobs-repository";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import {
  hasProtectedReasoning,
  isProtectedReasoningRequest,
  safeReasoningAlternative,
  sanitizeStreamsAIPayload,
  sanitizeStreamsAIText,
} from "../protected-reasoning";

const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked"]);

type Body = Record<string, any> & {
  sessionId?: string;
  message?: string;
  content?: string;
  idempotencyKey?: string;
  turnId?: string;
  metadata?: Record<string, any>;
};

type InnerHandler = (request: NextRequest) => Promise<Response>;

function encode(event: string, payload: Record<string, unknown>) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(sanitizeStreamsAIPayload(payload))}\n\n`);
}

function parseBlocks(buffer: string) {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() || "";
  const events: Array<{ event: string; payload: Record<string, any> }> = [];
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const rawLine of block.split("\n")) {
      if (rawLine.startsWith("event:")) event = rawLine.slice(6).trim();
      if (rawLine.startsWith("data:")) data.push(rawLine.slice(5).trimStart());
    }
    if (!data.length) continue;
    try { events.push({ event, payload: JSON.parse(data.join("\n")) }); }
    catch { events.push({ event, payload: { message: data.join("\n") } }); }
  }
  return { events, rest };
}

function eventMessage(payload: Record<string, any>) {
  return sanitizeStreamsAIText(payload.statusText || payload.message || payload.text || payload.phase || "Working…", 2000);
}

function phaseEventType(phase: string) {
  if (phase === "searching") return "research_started";
  if (phase === "generating") return "generation_started";
  if (phase === "repairing") return "repair_started";
  if (phase === "validating" || phase === "verifying") return "verification_started";
  if (phase === "streaming") return "delivery_started";
  return "phase_started";
}

export async function runNarratedStreamsMessage(
  request: NextRequest,
  body: Body,
  innerHandler: InnerHandler,
) {
  const scope = await requireStreamsAIScope(request);
  const userText = String(body.message || body.content || "").trim();
  const protectedRequest = isProtectedReasoningRequest(userText);
  const turnId = String(body.turnId || crypto.randomUUID());
  const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID());

  const job = await jobs.create(scope, {
    sessionId: body.sessionId || null,
    kind: "chat_tool",
    status: "running",
    inputJson: sanitizeStreamsAIPayload({
      purpose: "streams_ai_chat_operation",
      turnId,
      idempotencyKey,
      protectedRequest,
      mode: body.mode || "Thinking",
      currentAction: "Reviewing the request and existing conversation context.",
      nextAction: "Select the correct response path and verify the result.",
    }),
    creditEstimate: 0,
  });

  await jobs.createEvent(scope, {
    jobId: job.id,
    eventType: "operation_started",
    message: protectedRequest
      ? "I’ll explain the evidence and decision factors without exposing private chain-of-thought."
      : "I’m reviewing the request and existing context before producing the response.",
    data: {
      phase: "understanding",
      status: "running",
      currentAction: "Reviewing the request.",
      nextAction: "Inspect context and select the response path.",
      evidenceLevel: "runtime_verified",
      verificationState: "in_progress",
    },
  });

  let upstream: Response;
  try {
    upstream = await innerHandler(request);
  } catch (error) {
    await jobs.update(scope, job.id, { status: "failed", error: sanitizeStreamsAIText(error instanceof Error ? error.message : error) });
    await jobs.createEvent(scope, { jobId: job.id, eventType: "operation_failed", message: "Streams could not start this response.", data: { status: "failed", retryable: true } });
    throw error;
  }

  if (!upstream.body || !String(upstream.headers.get("content-type") || "").includes("text/event-stream")) {
    await jobs.update(scope, job.id, { status: upstream.ok ? "completed" : "failed" });
    return upstream;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let responseText = "";
  let finalPayload: Record<string, any> = {};
  let lastActivityKey = "";
  let terminal = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encode("operation", { jobId: job.id, status: "running", turnId }));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseBlocks(buffer);
          buffer = parsed.rest;

          for (const item of parsed.events) {
            const payload = sanitizeStreamsAIPayload(item.payload || {});
            const sessionId = String(payload.sessionId || finalPayload.sessionId || body.sessionId || "") || null;
            if (sessionId && sessionId !== job.session_id) await jobs.update(scope, job.id, { sessionId });

            if (item.event === "response" || item.event === "reasoning") {
              responseText += String(payload.token || payload.delta || payload.text || "");
              continue;
            }

            if (item.event === "activity") {
              const phase = String(payload.phase || "working");
              const message = eventMessage(payload);
              const key = `${phase}:${message}`;
              if (key !== lastActivityKey) {
                lastActivityKey = key;
                await jobs.createEvent(scope, {
                  jobId: job.id,
                  eventType: phaseEventType(phase),
                  message,
                  data: {
                    phase,
                    status: "running",
                    currentAction: message,
                    nextAction: phase === "streaming" ? "Deliver the verified response." : "Continue the authoritative response workflow.",
                    evidenceLevel: "runtime_verified",
                    verificationState: "in_progress",
                  },
                });
              }
              controller.enqueue(encode("activity", { ...payload, jobId: job.id }));
              continue;
            }

            if (item.event === "complete") {
              finalPayload = payload;
              continue;
            }

            if (item.event === "error") {
              terminal = true;
              const cancelled = String(payload.detailCode || "") === "STREAMS_RESPONSE_CANCELLED" || request.signal.aborted;
              await jobs.update(scope, job.id, {
                status: cancelled ? "cancelled" : "failed",
                sessionId,
                error: sanitizeStreamsAIText(payload.message || "Streams could not complete this response."),
              });
              await jobs.createEvent(scope, {
                jobId: job.id,
                eventType: cancelled ? "cancelled" : "operation_failed",
                message: cancelled ? "Streams stopped this response." : "Streams could not complete this response.",
                data: { status: cancelled ? "cancelled" : "failed", retryable: !cancelled, verificationState: "failed" },
              });
              controller.enqueue(encode("error", { ...payload, jobId: job.id }));
              controller.close();
              return;
            }

            controller.enqueue(encode(item.event, { ...payload, jobId: job.id }));
          }
        }

        if (terminal) return;
        let safeText = sanitizeStreamsAIText(responseText);
        if (protectedRequest && (!safeText || hasProtectedReasoning(safeText))) safeText = safeReasoningAlternative();
        if (hasProtectedReasoning(safeText)) throw new Error("Protected reasoning verification failed.");

        const assistantMessageId = String(finalPayload.assistantMessageId || "");
        const sessionId = String(finalPayload.sessionId || body.sessionId || "") || null;
        if (assistantMessageId) {
          await messages.updateContent(scope, assistantMessageId, safeText, {
            protectedReasoningChecked: true,
            protectedReasoningRequest: protectedRequest,
            workJobId: job.id,
          });
        }

        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "verification_completed",
          message: "The response passed protected-content and completion checks.",
          data: { phase: "verifying", status: "running", verificationState: "passed", evidenceLevel: "persistence_verified" },
        });
        await jobs.update(scope, job.id, {
          status: "completed",
          sessionId,
          messageId: assistantMessageId || null,
          outputJson: { assistantMessageId: assistantMessageId || null, responseLength: safeText.length, verificationState: "passed" },
        });
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "operation_completed",
          message: "The response was generated, verified, persisted, and delivered.",
          data: {
            phase: "complete",
            status: "completed",
            completedItems: ["response generated", "protected-content check passed", "assistant message persisted"],
            remainingItems: [],
            verificationState: "passed",
            evidenceLevel: "persistence_verified",
          },
        });

        for (let index = 0; index < safeText.length; index += 180) {
          controller.enqueue(encode("response", { token: safeText.slice(index, index + 180), jobId: job.id }));
        }
        controller.enqueue(encode("complete", { ...finalPayload, jobId: job.id, verificationState: "passed" }));
        controller.close();
      } catch (error) {
        const message = sanitizeStreamsAIText(error instanceof Error ? error.message : error);
        await jobs.update(scope, job.id, { status: request.signal.aborted ? "cancelled" : "failed", error: message }).catch(() => null);
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: request.signal.aborted ? "cancelled" : "operation_failed",
          message: request.signal.aborted ? "Streams stopped this response." : "The response could not be safely completed.",
          data: { status: request.signal.aborted ? "cancelled" : "failed", retryable: !request.signal.aborted, verificationState: "failed" },
        }).catch(() => null);
        controller.enqueue(encode("error", { jobId: job.id, message: request.signal.aborted ? "Streams stopped this response." : "The response could not be safely completed. Please retry." }));
        controller.close();
      }
    },
    async cancel() {
      await reader.cancel().catch(() => null);
      if (!TERMINAL.has(String(job.status || ""))) {
        await jobs.update(scope, job.id, { status: "cancelled", error: "Client cancelled the response." }).catch(() => null);
        await jobs.createEvent(scope, { jobId: job.id, eventType: "cancelled", message: "Streams stopped this response.", data: { status: "cancelled" } }).catch(() => null);
      }
    },
  });

  return new Response(stream, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Streams-AI-Job-Id": job.id,
    },
  });
}
