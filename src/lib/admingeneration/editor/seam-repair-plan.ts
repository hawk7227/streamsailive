export type SeamRepairPlan = {
  ok: boolean;
  status: "ready" | "needs_segments" | "needs_output";
  preRollFrames: number;
  postRollFrames: number;
  requiredSteps: string[];
};

export function buildSeamRepairPlan(input: {
  selectedTarget?: any;
  fps?: number;
  outputAssetId?: string | null;
  outputUrl?: string | null;
}): SeamRepairPlan {
  const fps = Number.isFinite(Number(input.fps)) ? Number(input.fps) : 24;
  const hasTarget = Boolean(input.selectedTarget?.id || input.selectedTarget?.segmentId);
  const hasOutput = Boolean(input.outputAssetId || input.outputUrl);

  const requiredSteps = [
    "extract_pre_roll_frames",
    "extract_post_roll_frames",
    "match_color_and_lighting",
    "smooth_motion_boundary",
    "crossfade_audio_boundary",
    "validate_scene_continuity",
    "write_new_version",
  ];

  if (!hasTarget) {
    return {
      ok: false,
      status: "needs_segments",
      preRollFrames: Math.round(fps * 0.5),
      postRollFrames: Math.round(fps * 0.5),
      requiredSteps,
    };
  }

  if (!hasOutput) {
    return {
      ok: false,
      status: "needs_output",
      preRollFrames: Math.round(fps * 0.5),
      postRollFrames: Math.round(fps * 0.5),
      requiredSteps,
    };
  }

  return {
    ok: true,
    status: "ready",
    preRollFrames: Math.round(fps * 0.5),
    postRollFrames: Math.round(fps * 0.5),
    requiredSteps,
  };
}
