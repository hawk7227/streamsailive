import { NextResponse } from "next/server";
import { updateAnalyzerWorkerJob } from "@/lib/admingeneration/video-analysis-worker-jobs";
import {
  hasTrustedAnalyzerWorkerAuth,
  recordVideoAnalyzerWorkerEvent,
} from "@/lib/admingeneration/video-analyzer-intelligence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; jobId: string }> };

export async function POST(request: Request, context: Params) {
  if (!hasTrustedAnalyzerWorkerAuth(request)) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-worker-heartbeat", error: "Unauthorized worker heartbeat." },
      { status: 401 },
    );
  }

  const { id, jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (!id || !jobId) {
    return NextResponse.json({ ok: false, error: "analysis id and worker job id are required" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "running";
  const stage = typeof body.stage === "string" ? body.stage : status;
  const message = typeof body.message === "string" ? body.message : `Worker heartbeat: ${stage}`;

  const jobResult = await updateAnalyzerWorkerJob({
    analysisId: id,
    jobId,
    status,
    stage,
    lastError: typeof body.lastError === "string" ? body.lastError : undefined,
    metadata: {
      heartbeatAt: new Date().toISOString(),
      stage,
      status,
      progress: typeof body.progress === "number" ? body.progress : null,
      details: body.details || null,
    },
    started: Boolean(body.started),
    completed: status === "completed" || Boolean(body.completed),
  });

  if (!jobResult.ok) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-worker-heartbeat", error: jobResult.error },
      { status: 500 },
    );
  }

  const eventResult = await recordVideoAnalyzerWorkerEvent(id, {
    eventType: "worker_heartbeat",
    status,
    message,
    jobId,
    stage,
    progress: typeof body.progress === "number" ? body.progress : null,
    analysisStatus: status === "failed" ? "failed" : "analyzing",
  });

  return NextResponse.json({
    ok: true,
    route: "admingeneration-worker-heartbeat",
    analysisId: id,
    jobId,
    job: jobResult.job,
    workerEvent: eventResult.ok ? eventResult.workerEvent : null,
    workerEventError: eventResult.ok ? null : eventResult.error,
  });
}
