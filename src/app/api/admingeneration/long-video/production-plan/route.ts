import { NextResponse } from "next/server";
import { buildLongVideoStoryBible } from "@/lib/admingeneration/long-video/long-video-story-bible";
import { buildProfessionalShotPlan } from "@/lib/admingeneration/long-video/long-video-shot-planner";
import { buildLongVideoContinuityPlan } from "@/lib/admingeneration/long-video/long-video-continuity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  projectId?: string;
  title?: string;
  prompt?: string;
  style?: string;
  aspectRatio?: string;
  fps?: number;
  targetDurationSec?: number;
  maxShotDurationSec?: number;
  intelligence?: any;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const projectId = body.projectId || `long-video-${Date.now()}`;

  const storyBible = buildLongVideoStoryBible({
    projectId,
    title: body.title,
    prompt: body.prompt,
    style: body.style,
    aspectRatio: body.aspectRatio,
    fps: body.fps,
    intelligence: body.intelligence,
  });

  const productionPlan = buildProfessionalShotPlan({
    projectId,
    storyBible,
    targetDurationSec: body.targetDurationSec,
    maxShotDurationSec: body.maxShotDurationSec,
    instruction: body.prompt,
  });

  const continuityPlan = buildLongVideoContinuityPlan(productionPlan);

  return NextResponse.json({
    ok: true,
    status: "planned",
    generationMode: "long_video",
    projectId,
    storyBible,
    productionPlan,
    continuityPlan,
    nextRequiredStep:
      "Dispatch each shot to real provider jobs, persist clip outputs, run continuity QA, then stitch/export with output proof.",
  });
}
