import { NextResponse } from "next/server";
import { buildMinimalLongVideoProductionPlan } from "@/lib/admingeneration/long-video/minimal-long-video-production";
import { buildLongVideoDispatchPlan } from "@/lib/admingeneration/long-video/long-video-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const productionPlan = buildMinimalLongVideoProductionPlan({
    projectId: body.projectId,
    prompt: body.prompt,
    targetDurationSec: body.targetDurationSec,
    maxShotDurationSec: body.maxShotDurationSec,
    fps: body.fps,
    aspectRatio: body.aspectRatio,
    referenceAssetIds: body.referenceAssetIds,
    identityDescription: body.identityDescription,
  });

  const dispatchPlan = buildLongVideoDispatchPlan(productionPlan);

  return NextResponse.json({
    ok: true,
    status: "ready_to_dispatch",
    generationMode: "long_video",
    productionPlan,
    dispatchPlan,
    next: {
      dispatchRoute: "/api/admingeneration/long-video/dispatch",
      statusRoute: "/api/admingeneration/long-video/status",
      continuityQaRoute: "/api/admingeneration/long-video/continuity-qa",
      stitchSubmitRoute: "/api/admingeneration/long-video/stitch-submit",
    },
  });
}
