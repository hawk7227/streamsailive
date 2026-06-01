import { NextResponse } from "next/server";
import { getAnalyzerWorkerJob, updateAnalyzerWorkerJob } from "@/lib/admingeneration/video-analysis-worker-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; jobId: string }> };

export async function GET(_request: Request, context: Params) {
  const { id, jobId } = await context.params;
  const result = await getAnalyzerWorkerJob(id, jobId);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-reference-worker-job-status", error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true, route: "admingeneration-reference-worker-job-status", analysisId: id, job: result.job });
}

export async function PATCH(request: Request, context: Params) {
  const { id, jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const result = await updateAnalyzerWorkerJob({
    analysisId: id,
    jobId,
    status: typeof body.status === "string" ? body.status : undefined,
    stage: typeof body.stage === "string" ? body.stage : undefined,
    lastError: typeof body.lastError === "string" ? body.lastError : undefined,
    metadata: typeof body.metadata === "object" && body.metadata ? (body.metadata as Record<string, unknown>) : undefined,
    started: Boolean(body.started),
    completed: Boolean(body.completed),
  });

  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-reference-worker-job-status", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-reference-worker-job-status", analysisId: id, job: result.job });
}
