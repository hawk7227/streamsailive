import { NextResponse } from "next/server";
import { getReferenceAnalysis } from "@/lib/admingeneration/video-reference-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: "analysis id is required" }, { status: 400 });
  }

  const result = await getReferenceAnalysis(id);

  if (!result.record) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-reference-analysis-status",
        analysisId: id,
        persistence: result.persistence,
        error: result.error || "Reference analysis was not found.",
      },
      { status: result.persistence ? 404 : 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-analysis-status",
    analysisId: id,
    persistence: result.persistence,
    analysis: result.record,
  });
}
