import type { LongVideoPlan } from "./long-video-contract";

export type LongVideoStitchPlan = {
  ok: boolean;
  status: "ready" | "needs_clips";
  projectId: string;
  clipOrder: string[];
  seamRepair: Array<{
    between: [string, string];
    preRollFrames: number;
    postRollFrames: number;
    requiredSteps: string[];
  }>;
  audioPlan: {
    crossfadeSec: number;
    normalizeLoudness: boolean;
    preserveDialogueSync: boolean;
  };
  exportPlan: {
    container: "mp4";
    codec: "h264";
    fps: number;
    aspectRatio: string;
  };
};

export function buildLongVideoStitchPlan(plan: LongVideoPlan): LongVideoStitchPlan {
  const shots = plan.scenes.flatMap((scene) => scene.shots);
  const clipOrder = shots.map((shot) => shot.id);
  const preRollFrames = Math.round(plan.fps * 0.5);
  const postRollFrames = Math.round(plan.fps * 0.5);

  return {
    ok: clipOrder.length > 0,
    status: clipOrder.length ? "ready" : "needs_clips",
    projectId: plan.projectId,
    clipOrder,
    seamRepair: clipOrder.slice(0, -1).map((clipId, index) => ({
      between: [clipId, clipOrder[index + 1]],
      preRollFrames,
      postRollFrames,
      requiredSteps: [
        "match_color_and_lighting",
        "smooth_motion_boundary",
        "crossfade_audio_boundary",
        "validate_subject_identity",
        "validate_camera_continuity",
      ],
    })),
    audioPlan: {
      crossfadeSec: 0.25,
      normalizeLoudness: true,
      preserveDialogueSync: true,
    },
    exportPlan: {
      container: "mp4",
      codec: "h264",
      fps: plan.fps,
      aspectRatio: plan.aspectRatio,
    },
  };
}
