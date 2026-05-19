import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";

const jobs = new StreamsAIJobsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const jobId = request.nextUrl.searchParams.get("jobId");

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
