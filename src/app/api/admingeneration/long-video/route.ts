import { NextResponse } from "next/server";
import { buildMinimalLongVideoProductionPlan } from "@/lib/admingeneration/long-video/minimal-long-video-production";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type LongVideoRequest = {
  projectId?: string;
  prompt?: string;
  targetDurationSec?: number;
  maxShotDurationSec?: number;
  fps?: number;
  aspectRatio?: string;
  referenceAssetIds?: string[];
  identityDescription?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LongVideoRequest;

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

  return NextResponse.json({
    ok: true,
    status: "planned",
    generationMode: "long_video",
    productionPlan,
    nextRequiredStep:
      "Dispatch each planned shot to real provider jobs, store clip outputs, run continuity QA, then stitch/export with real output proof.",
  });
}
