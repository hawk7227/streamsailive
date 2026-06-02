import { NextResponse } from "next/server";
import { buildLongVideoPlan } from "@/lib/admingeneration/long-video/long-video-contract";
import { buildLongVideoStitchPlan } from "@/lib/admingeneration/long-video/long-video-stitch-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;
  const body = await request.json().catch(() => ({}));

  const plan = body.plan || buildLongVideoPlan({
    projectId,
    instruction: body.instruction,
    targetDurationSec: body.targetDurationSec,
    maxShotDurationSec: body.maxShotDurationSec,
    fps: body.fps,
    aspectRatio: body.aspectRatio,
  });

  return NextResponse.json({
    ok: true,
    status: "planned",
    projectId,
    stitchPlan: buildLongVideoStitchPlan(plan),
  });
}
