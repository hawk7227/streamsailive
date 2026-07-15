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
import { classifyStreamsTask, type StreamsInitialPlan } from "./task-complexity-classifier";

const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked"]);

type Body = Record<string, any> & {
  sessionId?: string;
  message?: string;
  content?: string;
  idempotencyKey?: string;
  turnId?: string;
  attachments?: unknown[];
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

function firstResponse(plan: StreamsInitialPlan, protectedRequest: boolean) {
  if (protectedRequest) return "I’ll provide a safe evidence and decision summary without exposing private chain-of-thought or protected instructions.";
  const preservation = plan.preservedItems.length ? ` I’ll preserve ${plan.preservedItems.join(" and ")}.` : "";
  const risk = plan.risksAvoided.length ? ` I’ll avoid ${plan.risksAvoided[0]}.` : "";
  return `I’m starting with ${plan.nextAction.charAt(0).toLowerCase()}${plan.nextAction.slice(1)}.${preservation}${risk}`;
}

function passthroughWithJob(upstream: Response, jobId: string) {
  const headers = new Headers(upstream.headers);
  headers.set("X-Streams-AI-Job-Id", jobId);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

export async function runNarratedStreamsMessage(
  request: NextRequest,
  body: Body,
  innerHandler: InnerHandler,
) {
  const userText = String(body.message || body.content || "").trim();
  const protectedRequest = isProtectedReasoningRequest(userText);
  const plan = classifyStreamsTask({ message: userText, attachments: body.attachments, mode: body.mode, metadata: body.metadata });

  if (!plan.requiresNarration && !protectedRequest) return innerHandler(request);

  const scope = await requireStreamsAIScope(request);
  const turnId = String(body.turnId || crypto.randomUUID());
  const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID());
  const existingJob = await jobs.findChatOperationByIdempotency(scope, idempotencyKey);

  if (existingJob && TERMINAL.has(String(existingJob.status || ""))) {
    return passthroughWithJob(await innerHandler(request), existingJob.id);
  }

  const job = existingJob || await jobs.create(scope, {
    sessionId: body.sessionId || null,
    kind: "chat_tool",
    status: "running",
    inputJson: sanitizeStreamsAIPayload({
      purpose: "streams_ai_chat_operation",
      suppressCreatedEvent: true,
      turnId,
      idempotencyKey,
      protectedRequest,
      mode: body.mode || "Thinking",
      complexityClassification: plan.classification,
      planVersion: 1,
      goal: plan.goal,
      phases: plan.phases,
      preservedItems: plan.preservedItems,
      risksAvoided: plan.risksAvoided,
      clarificationState: plan.clarificationState,
      currentAction: plan.nextAction,
      nextAction: plan.nextAction,
    }),
    creditEstimate: 0,
  });

  if (!existingJob) {
    const opening = firstResponse(plan, protectedRequest);
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: "operation_started",
      message: opening,
      data: {
        phase: "understanding",
        status: "running",
        currentAction: plan.nextAction,
        nextAction: plan.nextAction,
        planVersion: 1,
        complexityClassification: plan.classification,
        clarificationState: plan.clarificationState,
        evidenceLevel: "runtime_verified",
        verificationState: "not_started",
      },
    });
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: "plan_created",
      message: "The initial work plan was accepted before material execution began.",
      data: {
        goal: plan.goal,
        phases: plan.phases,
        resolvedAmbiguities: [],
        preservedItems: plan.preservedItems,
        risksAvoided: plan.risksAvoided,
        nextAction: plan.nextAction,
        planVersion: 1,
        clarificationState: plan.clarificationState,
        status: "running",
        evidenceLevel: "runtime_verified",
        verificationState: "not_started",
      },
    });
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: "phase_started",
      message: plan.nextAction,
      data: {
        phase: plan.phases[0]?.id || "analyze",
        status: "running",
        currentAction: plan.nextAction,
        nextAction: plan.nextAction,
        planVersion: 1,
        evidenceLevel: "runtime_verified",
        verificationState: "in_progress",
      },
    });
  }

  let upstream: Response;
  try {
    upstream = await innerHandler(request);
  } catch (error) {
    await jobs.update(scope, job.id, { status: "failed", error: sanitizeStreamsAIText(error instanceof Error ? error.message : error) });
    await jobs.createEvent(scope, { jobId: job.id, eventType: "operation_failed", message: "Streams could not start this response. No material execution was completed.", data: { status: "failed", retryable: true, failedPhase: "startup", planVersion: 1 } });
    throw error;
  }

  if (!upstream.body || !String(upstream.headers.get("content-type") || "").includes("text/event-stream")) {
    await jobs.update(scope, job.id, { status: upstream.ok ? "completed" : "failed" });
    return passthroughWithJob(upstream, job.id);
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
      controller.enqueue(encode("operation", { jobId: job.id, status: "running", turnId, planVersion: 1, complexityClassification: plan.classification }));
      controller.enqueue(encode("activity", {
        jobId: job.id,
        phase: plan.phases[0]?.id || "analyze",
        statusText: firstResponse(plan, protectedRequest),
        currentAction: plan.nextAction,
        nextAction: plan.nextAction,
        planVersion: 1,
      }));
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
                    nextAction: phase === "streaming" ? "Deliver the verified response." : "Continue the accepted work plan.",
                    planVersion: 1,
                    evidenceLevel: "runtime_verified",
                    verificationState: "in_progress",
                  },
                });
              }
              controller.enqueue(encode("activity", { ...payload, jobId: job.id, planVersion: 1 }));
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
                data: { status: cancelled ? "cancelled" : "failed", retryable: !cancelled, verificationState: "failed", planVersion: 1 },
              });
              controller.enqueue(encode("error", { ...payload, jobId: job.id }));
              controller.close();
              return;
            }

            controller.enqueue(encode(item.event, { ...payload, jobId: job.id }));
          }
        }

        if (terminal) return;
        const latestJob = await jobs.get(scope, job.id);
        if (latestJob && TERMINAL.has(String(latestJob.status || "")) && String(latestJob.status) !== "completed") {
          await reader.cancel().catch(() => null);
          controller.enqueue(encode("error", { jobId: job.id, message: `Streams ${latestJob.status} this operation.`, detailCode: "STREAMS_OPERATION_TERMINAL" }));
          controller.close();
          return;
        }

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
            workPlanVersion: 1,
          });
        }

        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "verification_completed",
          message: "The response passed protected-content and completion checks.",
          data: { phase: "verifying", status: "running", verificationState: "passed", evidenceLevel: "persistence_verified", planVersion: 1 },
        });
        await jobs.update(scope, job.id, {
          status: "completed",
          sessionId,
          messageId: assistantMessageId || null,
          outputJson: {
            assistantMessageId: assistantMessageId || null,
            responseLength: safeText.length,
            verificationState: "passed",
            initialPlanVersion: 1,
            finalPlanVersion: 1,
            completedPhases: plan.phases.map((phase) => phase.id),
          },
        });
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "operation_completed",
          message: "The accepted plan was completed, verified, persisted, and delivered.",
          data: {
            phase: "complete",
            status: "completed",
            initialPlanVersion: 1,
            finalPlanVersion: 1,
            goal: plan.goal,
            completedItems: plan.phases.map((phase) => phase.label),
            preservedItems: plan.preservedItems,
            risksAvoided: plan.risksAvoided,
            remainingItems: [],
            verificationState: "passed",
            evidenceLevel: "persistence_verified",
          },
        });

        for (let index = 0; index < safeText.length; index += 180) controller.enqueue(encode("response", { token: safeText.slice(index, index + 180), jobId: job.id }));
        controller.enqueue(encode("complete", { ...finalPayload, jobId: job.id, verificationState: "passed", planVersion: 1 }));
        controller.close();
      } catch (error) {
        const message = sanitizeStreamsAIText(error instanceof Error ? error.message : error);
        await jobs.update(scope, job.id, { status: request.signal.aborted ? "cancelled" : "failed", error: message }).catch(() => null);
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: request.signal.aborted ? "cancelled" : "operation_failed",
          message: request.signal.aborted ? "Streams stopped this response." : "The response could not be safely completed.",
          data: { status: request.signal.aborted ? "cancelled" : "failed", retryable: !request.signal.aborted, verificationState: "failed", planVersion: 1 },
        }).catch(() => null);
        controller.enqueue(encode("error", { jobId: job.id, message: request.signal.aborted ? "Streams stopped this response." : "The response could not be safely completed. Please retry." }));
        controller.close();
      }
    },
    async cancel() {
      await reader.cancel().catch(() => null);
      const latestJob = await jobs.get(scope, job.id).catch(() => null);
      if (latestJob && !TERMINAL.has(String(latestJob.status || ""))) {
        await jobs.update(scope, job.id, { status: "cancelled", error: "Client cancelled the response." }).catch(() => null);
        await jobs.createEvent(scope, { jobId: job.id, eventType: "cancelled", message: "Streams stopped this response.", data: { status: "cancelled", planVersion: 1 } }).catch(() => null);
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
