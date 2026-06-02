import type { MinimalLongVideoProductionPlan, LongVideoShotPlan } from "./minimal-long-video-production";

export type LongVideoShotDispatchPayload = {
  shotId: string;
  sceneId: string;
  providerIntent: string;
  prompt: string;
  negativePrompt: string;
  durationSec: number;
  referenceAssetIds: string[];
  identityAnchorIds: string[];
  startSec: number;
  endSec: number;
  preserveIdentity: true;
  longVideo: true;
  stitchRequired: true;
  qaRequired: true;
};

export type LongVideoDispatchPlan = {
  ok: true;
  mode: "long_video_dispatch";
  projectId: string;
  shotCount: number;
  dispatches: LongVideoShotDispatchPayload[];
};

function toDispatch(shot: LongVideoShotPlan): LongVideoShotDispatchPayload {
  return {
    shotId: shot.id,
    sceneId: shot.sceneId,
    providerIntent: shot.providerIntent,
    prompt: shot.prompt,
    negativePrompt: shot.negativePrompt,
    durationSec: shot.durationSec,
    referenceAssetIds: shot.referenceAssetIds,
    identityAnchorIds: shot.identityAnchorIds,
    startSec: shot.startSec,
    endSec: shot.endSec,
    preserveIdentity: true,
    longVideo: true,
    stitchRequired: true,
    qaRequired: true,
  };
}

export function buildLongVideoDispatchPlan(plan: MinimalLongVideoProductionPlan): LongVideoDispatchPlan {
  return {
    ok: true,
    mode: "long_video_dispatch",
    projectId: plan.projectId,
    shotCount: plan.shots.length,
    dispatches: plan.shots.map(toDispatch),
  };
}
