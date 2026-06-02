import { NextResponse } from "next/server";
import { buildLongVideoDispatchPlan } from "@/lib/admingeneration/long-video/long-video-dispatch";
import { buildMinimalLongVideoProductionPlan } from "@/lib/admingeneration/long-video/minimal-long-video-production";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

async function postJson(request: Request, path: string, body: unknown) {
  const response = await fetch(internalUrl(request, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.ok ? "submitted" : "failed",
    httpStatus: response.status,
    data,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const productionPlan =
    body.productionPlan ||
    buildMinimalLongVideoProductionPlan({
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

  const submittedShots = [];
  for (const shot of dispatchPlan.dispatches) {
    const result = await postJson(request, "/api/streams/video/generate", {
      prompt: shot.prompt,
      negativePrompt: shot.negativePrompt,
      durationSec: shot.durationSec,
      provider: shot.providerIntent,
      referenceAssetIds: shot.referenceAssetIds,
      longVideo: true,
      shotId: shot.shotId,
      sceneId: shot.sceneId,
      preserveIdentity: true,
      stitchRequired: true,
      qaRequired: true,
      metadata: shot,
    });

    submittedShots.push({
      shotId: shot.shotId,
      sceneId: shot.sceneId,
      providerIntent: shot.providerIntent,
      result,
    });
  }

  return NextResponse.json({
    ok: true,
    status: "dispatched",
    projectId: dispatchPlan.projectId,
    dispatchPlan,
    submittedShots,
    note: "Shot jobs were submitted to the existing video generation route. Completion depends on provider/job runtime.",
  });
}
