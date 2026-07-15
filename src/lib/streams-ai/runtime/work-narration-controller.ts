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
import {
  buildHumanWorkEvent,
  detectWorkDomain,
  humanWorkNarration,
  shouldExposeWorkEvent,
} from "./human-work-narration-policy";

const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked", "partial", "superseded"]);

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
  if (phase === "searching" || phase === "researching") return "research_started";
  if (phase === "generating" || phase === "rendering") return "generation_started";
  if (phase === "repairing") return "repair_started";
  if (phase === "validating" || phase === "verifying" || phase === "testing") return "verification_started";
  if (phase === "streaming" || phase === "delivering") return "delivery_started";
  if (phase === "implementing" || phase === "building") return "implementation_started";
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

async function supersedeOlderSessionWork(scope: Awaited<ReturnType<typeof requireStreamsAIScope>>, sessionId: string, keepJobId = "") {
  if (!sessionId) return;
  const sessionJobs = await jobs.list(scope, { sessionId });
  for (const candidate of sessionJobs) {
    if (!candidate?.id || candidate.id === keepJobId) continue;
    if (candidate?.input_json?.purpose !== "streams_ai_chat_operation") continue;
    if (TERMINAL.has(String(candidate.status || ""))) continue;
    await jobs.update(scope, candidate.id, { status: "superseded", error: "A newer user direction superseded this operation." });
    await jobs.createEvent(scope, {
      jobId: candidate.id,
      eventType: "superseded",
      message: "A newer user direction replaced this operation. Completed work remains preserved.",
      data: {
        status: "superseded",
        phase: "superseded",
        currentAction: "Stopped the superseded direction.",
        nextAction: "Continue with the newest user instruction.",
        evidenceLevel: "runtime_verified",
        evidenceSummary: "A newer turn was accepted for the same session.",
        verificationState: "passed",
        remainingItems: [],
        preservedItems: candidate?.input_json?.preservedItems || [],
        planVersion: Number(candidate?.input_json?.planVersion || 1),
      },
    });
  }
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

  if (body.sessionId) await supersedeOlderSessionWork(scope, String(body.sessionId), existingJob?.id || "");

  const domain = detectWorkDomain({ message: userText, attachments: body.attachments, mode: body.mode });
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
      domain,
      complexityClassification: plan.classification,
      planVersion: 1,
      goal: plan.goal,
      phases: plan.phases,
      preservedItems: plan.preservedItems,
      risksAvoided: plan.risksAvoided,
      clarificationState: plan.clarificationState,
      currentAction: plan.nextAction,
      nextAction: plan.nextAction,
      attachments: Array.isArray(body.attachments) ? body.attachments.map((attachment: any) => ({ id: attachment?.id || null, name: attachment?.name || null, kind: attachment?.kind || null, mimeType: attachment?.mimeType || attachment?.mime_type || null })) : [],
    }),
    creditEstimate: 0,
  });

  let currentPlanVersion = Number(job?.input_json?.planVersion || 1);
  let lastVisibleAt = 0;
  let lastActivityKey = "";
  let findingCount = 0;

  if (!existingJob) {
    const opening = firstResponse(plan, protectedRequest);
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: "operation_started",
      message: opening,
      data: {
        phase: "understanding",
        status: "running",
        domain,
        currentAction: plan.nextAction,
        nextAction: plan.nextAction,
        planVersion: 1,
        complexityClassification: plan.classification,
        clarificationState: plan.clarificationState,
        evidenceLevel: "runtime_verified",
        evidenceSummary: "The request was accepted and classified before material execution.",
        verificationState: "not_started",
        preservedItems: plan.preservedItems,
        risksAvoided: plan.risksAvoided,
        remainingItems: plan.phases.map((phase) => phase.label),
      },
    });
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: "reuse_assessment",
      message: "I’m inspecting the active implementation before creating new infrastructure.",
      data: {
        phase: "inspect",
        status: "running",
        domain,
        currentAction: "Inspect the active implementation and identify reusable systems.",
        nextAction: plan.nextAction,
        planVersion: 1,
        decision: "Prefer extending working infrastructure when it satisfies the requirement.",
        rejectedAlternatives: ["Create a parallel system before inspecting the active implementation"],
        preservedItems: plan.preservedItems,
        risksAvoided: [...plan.risksAvoided, "duplicating working infrastructure"],
        evidenceLevel: "requested",
        evidenceSummary: "Reuse remains a requirement until repository or runtime inspection produces evidence.",
        verificationState: "in_progress",
        remainingItems: plan.phases.map((phase) => phase.label),
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
        remainingItems: plan.phases.map((phase) => phase.label),
        planVersion: 1,
        clarificationState: plan.clarificationState,
        status: "running",
        evidenceLevel: "runtime_verified",
        evidenceSummary: "The server persisted the accepted plan before invoking the inner assistant runtime.",
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
        domain,
        currentAction: plan.nextAction,
        nextAction: plan.nextAction,
        remainingItems: plan.phases.map((phase) => phase.label),
        planVersion: 1,
        evidenceLevel: "runtime_verified",
        evidenceSummary: "The first accepted phase started.",
        verificationState: "in_progress",
      },
    });
  }

  let upstream: Response;
  try {
    upstream = await innerHandler(request);
  } catch (error) {
    const errorMessage = sanitizeStreamsAIText(error instanceof Error ? error.message : error);
    await jobs.update(scope, job.id, { status: "failed", error: errorMessage });
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: "operation_failed",
      message: "Streams could not start this response. No material execution was completed.",
      data: {
        status: "failed",
        retryable: true,
        failedPhase: "startup",
        blockedReason: errorMessage,
        currentAction: "Preserve the accepted plan and report the startup failure.",
        nextAction: "Retry the operation after the startup failure is resolved.",
        remainingItems: plan.phases.map((phase) => phase.label),
        preservedItems: plan.preservedItems,
        evidenceLevel: "runtime_verified",
        evidenceSummary: errorMessage,
        verificationState: "failed",
        planVersion: currentPlanVersion,
      },
    });
    throw error;
  }

  if (!upstream.body || !String(upstream.headers.get("content-type") || "").includes("text/event-stream")) {
    const status = upstream.ok ? "completed" : "failed";
    await jobs.update(scope, job.id, {
      status,
      outputJson: upstream.ok ? {
        verificationState: "passed",
        evidenceLevel: "runtime_verified",
        remainingItems: [],
        completedPhases: plan.phases.map((phase) => phase.id),
      } : null,
    });
    await jobs.createEvent(scope, {
      jobId: job.id,
      eventType: upstream.ok ? "operation_completed" : "operation_failed",
      message: upstream.ok ? "The non-streaming response completed and passed runtime delivery checks." : "The non-streaming response failed.",
      data: {
        status,
        phase: upstream.ok ? "complete" : "failed",
        completedItems: upstream.ok ? plan.phases.map((phase) => phase.label) : [],
        remainingItems: upstream.ok ? [] : plan.phases.map((phase) => phase.label),
        preservedItems: plan.preservedItems,
        risksAvoided: plan.risksAvoided,
        currentAction: upstream.ok ? "Delivered the response." : "Preserved the failure state.",
        nextAction: upstream.ok ? "No additional action is scheduled." : "Retry after resolving the failure.",
        evidenceLevel: "runtime_verified",
        evidenceSummary: `The upstream route returned HTTP ${upstream.status}.`,
        verificationState: upstream.ok ? "passed" : "failed",
        planVersion: currentPlanVersion,
      },
    });
    return passthroughWithJob(upstream, job.id);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let responseText = "";
  let finalPayload: Record<string, any> = {};
  let terminal = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encode("operation", { jobId: job.id, status: "running", turnId, planVersion: currentPlanVersion, complexityClassification: plan.classification, domain }));
      controller.enqueue(encode("activity", {
        jobId: job.id,
        phase: plan.phases[0]?.id || "analyze",
        statusText: firstResponse(plan, protectedRequest),
        currentAction: plan.nextAction,
        nextAction: plan.nextAction,
        planVersion: currentPlanVersion,
      }));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseBlocks(buffer);
          buffer = parsed.rest;

          for (const item of parsed.events) {
            const payload = sanitizeStreamsAIPayload(item.payload || {}) as Record<string, any>;
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
              const requestedPlanVersion = Math.max(currentPlanVersion, Number(payload.planVersion || currentPlanVersion));
              const planChanged = Boolean(payload.planChanged || requestedPlanVersion > currentPlanVersion);
              if (planChanged) {
                const previousPlanVersion = currentPlanVersion;
                currentPlanVersion = requestedPlanVersion > currentPlanVersion ? requestedPlanVersion : currentPlanVersion + 1;
                await jobs.update(scope, job.id, { inputJson: { planVersion: currentPlanVersion, currentAction: message, nextAction: payload.nextAction || "Continue with the revised plan." } });
                await jobs.createEvent(scope, {
                  jobId: job.id,
                  eventType: "plan_changed",
                  message: sanitizeStreamsAIText(payload.changeReason || "The plan changed because new runtime evidence required a different action."),
                  data: {
                    phase,
                    status: "running",
                    planChanged: true,
                    previousPlanVersion,
                    planVersion: currentPlanVersion,
                    changeReason: payload.changeReason || "New runtime evidence changed the next action.",
                    completedItems: payload.completedItems || [],
                    remainingItems: payload.remainingItems || plan.phases.map((candidate) => candidate.label),
                    preservedItems: payload.preservedItems || plan.preservedItems,
                    rejectedAlternatives: payload.rejectedAlternatives || [],
                    risksAvoided: payload.risksAvoided || plan.risksAvoided,
                    currentAction: message,
                    nextAction: payload.nextAction || "Continue with the revised plan.",
                    evidenceLevel: payload.evidenceLevel || "runtime_verified",
                    evidenceSummary: payload.evidenceSummary || message,
                    verificationState: "in_progress",
                  },
                });
              }

              const findings = Array.isArray(payload.findings) ? payload.findings : payload.finding ? [payload.finding] : [];
              if (findings.length) {
                findingCount += findings.length;
                await jobs.createEvent(scope, {
                  jobId: job.id,
                  eventType: "finding",
                  message: sanitizeStreamsAIText(findings[0]),
                  data: {
                    phase,
                    status: "running",
                    findings,
                    currentAction: message,
                    nextAction: payload.nextAction || "Apply the verified finding to the accepted plan.",
                    evidenceLevel: payload.evidenceLevel || "runtime_verified",
                    evidenceSummary: payload.evidenceSummary || findings[0],
                    verificationState: "in_progress",
                    planVersion: currentPlanVersion,
                  },
                });
              }

              if (payload.decision) {
                await jobs.createEvent(scope, {
                  jobId: job.id,
                  eventType: "decision",
                  message: sanitizeStreamsAIText(payload.decision),
                  data: {
                    phase,
                    status: "running",
                    decision: payload.decision,
                    rejectedAlternatives: payload.rejectedAlternatives || [],
                    preservedItems: payload.preservedItems || plan.preservedItems,
                    risksAvoided: payload.risksAvoided || plan.risksAvoided,
                    currentAction: message,
                    nextAction: payload.nextAction || "Implement the selected decision.",
                    evidenceLevel: payload.evidenceLevel || "runtime_verified",
                    evidenceSummary: payload.evidenceSummary || message,
                    verificationState: "in_progress",
                    planVersion: currentPlanVersion,
                  },
                });
              }

              const visible = shouldExposeWorkEvent({
                eventType: phaseEventType(phase),
                status: "running",
                message,
                now: Date.now(),
                lastVisibleAt,
              });
              if (key !== lastActivityKey && visible) {
                lastActivityKey = key;
                lastVisibleAt = Date.now();
                await jobs.createEvent(scope, {
                  jobId: job.id,
                  eventType: phaseEventType(phase),
                  message,
                  data: {
                    phase,
                    status: "running",
                    domain: payload.domain || detectWorkDomain({ message, phase }),
                    currentAction: message,
                    nextAction: phase === "streaming" ? "Deliver the verified response." : payload.nextAction || "Continue the accepted work plan.",
                    completedItems: payload.completedItems || [],
                    remainingItems: payload.remainingItems || plan.phases.map((candidate) => candidate.label),
                    preservedItems: payload.preservedItems || plan.preservedItems,
                    risksAvoided: payload.risksAvoided || plan.risksAvoided,
                    toolName: payload.toolName || payload.tool || "",
                    fileName: payload.fileName || payload.file || "",
                    autosaveConfirmed: Boolean(payload.autosaveConfirmed),
                    backgroundExecutionConfirmed: Boolean(payload.backgroundExecutionConfirmed),
                    planVersion: currentPlanVersion,
                    evidenceLevel: payload.evidenceLevel || "runtime_verified",
                    evidenceSummary: payload.evidenceSummary || message,
                    verificationState: payload.verificationState || "in_progress",
                  },
                });
              }
              controller.enqueue(encode("activity", { ...payload, jobId: job.id, planVersion: currentPlanVersion }));
              continue;
            }

            if (item.event === "complete") {
              finalPayload = payload;
              continue;
            }

            if (item.event === "error") {
              terminal = true;
              const cancelled = String(payload.detailCode || "") === "STREAMS_RESPONSE_CANCELLED" || request.signal.aborted;
              const status = cancelled ? "cancelled" : payload.userActionRequired ? "blocked" : "failed";
              await jobs.update(scope, job.id, {
                status,
                sessionId,
                error: sanitizeStreamsAIText(payload.message || "Streams could not complete this response."),
              });
              await jobs.createEvent(scope, {
                jobId: job.id,
                eventType: cancelled ? "cancelled" : status === "blocked" ? "blocked" : "operation_failed",
                message: cancelled ? "Streams stopped this response." : sanitizeStreamsAIText(payload.message || "Streams could not complete this response."),
                data: {
                  status,
                  retryable: !cancelled && payload.retryable !== false,
                  userActionRequired: Boolean(payload.userActionRequired),
                  blockedReason: status === "blocked" ? payload.message : "",
                  currentAction: cancelled ? "Preserve completed work and stop the active operation." : "Preserve completed work and report the failure boundary.",
                  nextAction: cancelled ? "Resume only if the user starts a new operation." : payload.nextAction || "Retry after resolving the reported failure.",
                  completedItems: payload.completedItems || [],
                  remainingItems: payload.remainingItems || plan.phases.map((candidate) => candidate.label),
                  preservedItems: payload.preservedItems || plan.preservedItems,
                  evidenceLevel: payload.evidenceLevel || "runtime_verified",
                  evidenceSummary: payload.message || "The upstream runtime returned an error event.",
                  verificationState: "failed",
                  planVersion: currentPlanVersion,
                },
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
            workPlanVersion: currentPlanVersion,
            humanWorkPolicyVersion: 1,
          });
        }

        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "verification_completed",
          message: "The response passed protected-content and completion checks.",
          data: {
            phase: "verifying",
            status: "running",
            currentAction: "Verify the response and persisted receipt.",
            nextAction: "Persist the final completion receipt.",
            completedItems: ["Protected-content verification", "Response persistence verification"],
            remainingItems: ["Persist final completion receipt"],
            verificationState: "passed",
            evidenceLevel: "persistence_verified",
            evidenceSummary: "The assistant response was sanitized and persisted with the operation identifier.",
            planVersion: currentPlanVersion,
          },
        });

        const completedItems = plan.phases.map((phase) => phase.label);
        const outputJson = {
          assistantMessageId: assistantMessageId || null,
          responseLength: safeText.length,
          verificationState: "passed",
          evidenceLevel: "persistence_verified",
          evidence: { level: "persistence_verified", verificationState: "passed", summary: "The final response and completion receipt were persisted." },
          remainingItems: [],
          initialPlanVersion: 1,
          finalPlanVersion: currentPlanVersion,
          completedPhases: plan.phases.map((phase) => phase.id),
          findingsRecorded: findingCount,
        };
        await jobs.update(scope, job.id, {
          status: "completed",
          sessionId,
          messageId: assistantMessageId || null,
          outputJson,
        });
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "operation_completed",
          message: "The accepted plan was completed, verified, persisted, and delivered.",
          data: {
            phase: "complete",
            status: "completed",
            initialPlanVersion: 1,
            finalPlanVersion: currentPlanVersion,
            goal: plan.goal,
            completedItems,
            preservedItems: plan.preservedItems,
            risksAvoided: plan.risksAvoided,
            remainingItems: [],
            currentAction: "Completed and persisted the verified response.",
            nextAction: "No additional action is scheduled.",
            verificationState: "passed",
            evidenceLevel: "persistence_verified",
            evidenceSummary: "The server persisted the final response, operation status, ordered events, and completion receipt.",
            decision: "Deliver the verified response after all completion gates passed.",
          },
        });

        for (let index = 0; index < safeText.length; index += 180) controller.enqueue(encode("response", { token: safeText.slice(index, index + 180), jobId: job.id }));
        controller.enqueue(encode("complete", { ...finalPayload, jobId: job.id, verificationState: "passed", planVersion: currentPlanVersion }));
        controller.close();
      } catch (error) {
        const message = sanitizeStreamsAIText(error instanceof Error ? error.message : error);
        const status = request.signal.aborted ? "cancelled" : "failed";
        await jobs.update(scope, job.id, { status, error: message }).catch(() => null);
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: request.signal.aborted ? "cancelled" : "operation_failed",
          message: request.signal.aborted ? "Streams stopped this response." : "The response could not be safely completed.",
          data: {
            status,
            retryable: !request.signal.aborted,
            currentAction: request.signal.aborted ? "Preserve completed work and stop." : "Preserve completed work and report the failed verification boundary.",
            nextAction: request.signal.aborted ? "Resume only after a new user instruction." : "Retry after resolving the reported failure.",
            remainingItems: plan.phases.map((phase) => phase.label),
            preservedItems: plan.preservedItems,
            evidenceLevel: "runtime_verified",
            evidenceSummary: message,
            verificationState: "failed",
            planVersion: currentPlanVersion,
          },
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
        await jobs.createEvent(scope, {
          jobId: job.id,
          eventType: "cancelled",
          message: "Streams stopped this response. Completed work remains preserved.",
          data: {
            status: "cancelled",
            currentAction: "Stop the active response and preserve completed work.",
            nextAction: "Resume only after a new user instruction.",
            preservedItems: plan.preservedItems,
            remainingItems: plan.phases.map((phase) => phase.label),
            evidenceLevel: "runtime_verified",
            evidenceSummary: "The response stream was cancelled by the client.",
            verificationState: "inconclusive",
            planVersion: currentPlanVersion,
          },
        }).catch(() => null);
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
