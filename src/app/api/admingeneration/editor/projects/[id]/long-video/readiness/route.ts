import { NextResponse } from "next/server";
import { buildLongVideoPlan } from "@/lib/admingeneration/long-video/long-video-contract";
import { buildLongVideoStitchPlan } from "@/lib/admingeneration/long-video/long-video-stitch-plan";
import { evaluateLongVideoReadiness } from "@/lib/admingeneration/long-video/long-video-readiness";

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

  const stitchPlan = body.stitchPlan || buildLongVideoStitchPlan(plan);

  return NextResponse.json({
    ok: true,
    projectId,
    readiness: evaluateLongVideoReadiness({ plan, stitchPlan }),
  });
}
