import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { assertNoProtectedFields, sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

const jobs = new StreamsAIJobsRepository();
const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked"]);

function isWorkerAuthorized(request: NextRequest) {
  const expected = (process.env.STREAMS_BUILDER_WORKER_SECRET || process.env.STREAMS_AI_WORKER_SECRET || process.env.CRON_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") || "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  return auth === `Bearer ${expected}` || querySecret === expected;
}

async function readJobWithWorkerSecret(jobId: string) {
  const client = streamsAISchema(createStreamsAIServiceClient());
  const { data: job, error: jobError } = await client.from(streamsAITables.jobs).select("*").eq("id", jobId).maybeSingle();
  if (jobError) throw new Error(`Failed to read STREAMS AI job: ${jobError.message}`);
  if (!job) return null;
  const { data: events, error: eventsError } = await client.from(streamsAITables.jobEvents).select("*").eq("job_id", jobId).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (eventsError) throw new Error(`Failed to read STREAMS AI job events: ${eventsError.message}`);
  const inputJson = job.input_json && typeof job.input_json === "object" ? job.input_json as Record<string, unknown> : {};
  return sanitizeStreamsAIPayload({ job: { ...job, metadata: (job as Record<string, unknown>).metadata || inputJson.metadata }, events: events || [] });
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (jobId && isWorkerAuthorized(request)) {
      const data = await readJobWithWorkerSecret(jobId);
      if (!data) return streamsAIJson({ ok: false, error: "Job not found" }, 404);
      return streamsAIJson({ ok: true, ...data, authMode: "worker-secret" });
    }
    const scope = await requireStreamsAIScope(request);
    if (jobId) {
      const job = await jobs.get(scope, jobId);
      if (!job) return streamsAIJson({ ok: false, error: "Job not found" }, 404);
      return streamsAIJson(sanitizeStreamsAIPayload({ ok: true, job, events: await jobs.events(scope, jobId) }));
    }
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const status = request.nextUrl.searchParams.get("status");
    return streamsAIJson(sanitizeStreamsAIPayload({ ok: true, jobs: await jobs.list(scope, { sessionId, status }) }));
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await readJsonBody<any>(request));
    assertNoProtectedFields(body);
    const job = await jobs.create(scope, {
      projectId: body.projectId,
      sessionId: body.sessionId,
      messageId: body.messageId,
      toolCallId: body.toolCallId,
      productId: body.productId,
      kind: body.kind,
      status: body.status,
      inputJson: body.inputJson,
      creditEstimate: body.creditEstimate,
    });
    return streamsAIJson({ ok: true, job }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await readJsonBody<any>(request));
    assertNoProtectedFields(body);
    if (!body.jobId) return streamsAIJson({ ok: false, error: "jobId is required" }, 400);
    const job = await jobs.get(scope, body.jobId);
    if (!job) return streamsAIJson({ ok: false, error: "Job not found" }, 404);

    const action = String(body.action || "event");
    if (action === "cancel") {
      if (TERMINAL.has(String(job.status || ""))) return streamsAIJson({ ok: true, job, alreadyTerminal: true });
      const updated = await jobs.update(scope, body.jobId, { status: "cancelled", error: "User requested cancellation." });
      const event = await jobs.createEvent(scope, {
        jobId: body.jobId,
        eventType: "cancelled",
        message: "Streams stopped this operation. Completed work remains preserved.",
        data: { phase: "cancelled", status: "cancelled", verificationState: "inconclusive", userActionRequired: false },
      });
      return streamsAIJson({ ok: true, job: updated, event });
    }

    if (action === "block" || action === "fail") {
      const status = action === "block" ? "blocked" : "failed";
      const updated = await jobs.update(scope, body.jobId, { status, error: sanitizeStreamsAIText(body.message || `${status} operation`) });
      const event = await jobs.createEvent(scope, {
        jobId: body.jobId,
        eventType: action === "block" ? "blocked" : "operation_failed",
        message: sanitizeStreamsAIText(body.message || (action === "block" ? "The operation is blocked." : "The operation failed.")),
        data: sanitizeStreamsAIPayload({ ...(body.data || {}), status, retryable: body.retryable !== false, userActionRequired: Boolean(body.userActionRequired) }),
      });
      return streamsAIJson({ ok: true, job: updated, event });
    }

    if (!body.eventType) return streamsAIJson({ ok: false, error: "eventType is required" }, 400);
    const event = await jobs.createEvent(scope, {
      jobId: body.jobId,
      eventType: body.eventType,
      message: body.message ? sanitizeStreamsAIText(body.message) : null,
      data: sanitizeStreamsAIPayload(body.data || {}),
    });
    return streamsAIJson({ ok: true, event });
  } catch (error) {
    return streamsAIError(error);
  }
}
