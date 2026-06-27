import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";

const jobs = new StreamsAIJobsRepository();

function isWorkerAuthorized(request: NextRequest) {
  const expected = (process.env.STREAMS_BUILDER_WORKER_SECRET || process.env.STREAMS_AI_WORKER_SECRET || process.env.CRON_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") || "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  return auth === `Bearer ${expected}` || querySecret === expected;
}

async function readJobWithWorkerSecret(jobId: string) {
  const client = streamsAISchema(createStreamsAIServiceClient());
  const { data: job, error: jobError } = await client
    .from(streamsAITables.jobs)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw new Error(`Failed to read STREAMS AI job: ${jobError.message}`);
  if (!job) return null;

  const { data: events, error: eventsError } = await client
    .from(streamsAITables.jobEvents)
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (eventsError) throw new Error(`Failed to read STREAMS AI job events: ${eventsError.message}`);

  const inputJson = job.input_json && typeof job.input_json === "object" ? job.input_json as Record<string, unknown> : {};
  return { job: { ...job, metadata: (job as Record<string, unknown>).metadata || inputJson.metadata }, events: events || [] };
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (jobId && isWorkerAuthorized(request)) {
      const data = await readJobWithWorkerSecret(jobId);
      if (!data) return streamsAIJson({ ok: false, error: "Job not found" }, 404);
      return streamsAIJson({ ok: true, job: data.job, events: data.events, authMode: "worker-secret" });
    }

    const scope = await requireStreamsAIScope(request);

    if (jobId) {
      const job = await jobs.get(scope, jobId);
      if (!job) return streamsAIJson({ ok: false, error: "Job not found" }, 404);
      const events = await jobs.events(scope, jobId);
      return streamsAIJson({ ok: true, job, events });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const status = request.nextUrl.searchParams.get("status");
    const data = await jobs.list(scope, { sessionId, status });
    return streamsAIJson({ ok: true, jobs: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      projectId?: string | null;
      sessionId?: string | null;
      messageId?: string | null;
      toolCallId?: string | null;
      productId?: string | null;
      kind?: string;
      status?: string;
      inputJson?: Record<string, unknown>;
      creditEstimate?: number;
    }>(request);

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
    const body = await readJsonBody<{
      jobId?: string;
      eventType?: string;
      message?: string | null;
      data?: Record<string, unknown>;
    }>(request);

    if (!body.jobId) return streamsAIJson({ ok: false, error: "jobId is required" }, 400);
    if (!body.eventType) return streamsAIJson({ ok: false, error: "eventType is required" }, 400);

    const job = await jobs.get(scope, body.jobId);
    if (!job) return streamsAIJson({ ok: false, error: "Job not found" }, 404);

    const event = await jobs.createEvent(scope, {
      jobId: body.jobId,
      eventType: body.eventType,
      message: body.message,
      data: body.data,
    });

    return streamsAIJson({ ok: true, event });
  } catch (error) {
    return streamsAIError(error);
  }
}
