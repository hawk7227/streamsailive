import { NextResponse } from "next/server";
import { buildSeamRepairPlan } from "@/lib/admingeneration/editor/seam-repair-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    projectId,
    plan: buildSeamRepairPlan({
      selectedTarget: body.selectedTarget,
      fps: body.fps,
      outputAssetId: body.outputAssetId,
      outputUrl: body.outputUrl,
    }),
  });
}
