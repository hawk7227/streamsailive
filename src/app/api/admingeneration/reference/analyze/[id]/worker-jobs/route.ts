import { NextResponse } from "next/server";
import { createAnalyzerWorkerJob } from "@/lib/admingeneration/video-analysis-worker-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!id) return NextResponse.json({ ok: false, error: "analysis id is required" }, { status: 400 });

  const requestedProfile =
    body.requestedProfile === "card_standard" || body.requestedProfile === "editor_full" || body.requestedProfile === "admin_full"
      ? body.requestedProfile
      : "admin_full";

  const result = await createAnalyzerWorkerJob({ analysisId: id, requestedProfile });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-reference-worker-jobs", error: result.error, requiredMigration: "requiredMigration" in result ? result.requiredMigration : null }, { status: 500 });

  return NextResponse.json({ ok: true, route: "admingeneration-reference-worker-jobs", analysisId: id, job: result.job, analysis: result.analysis });
}
