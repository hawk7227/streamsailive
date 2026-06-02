import type { LongVideoProductionPlan, PlannedLongVideoShot } from "./long-video-shot-planner";

export type ShotContinuityCheck = {
  shotId: string;
  status: "needs_output" | "needs_check" | "pass" | "fail";
  checks: string[];
};

export type LongVideoContinuityPlan = {
  projectId: string;
  status: "planned";
  shotChecks: ShotContinuityCheck[];
  stitchOrder: string[];
  seamRepairSteps: Array<{
    between: [string, string];
    required: string[];
  }>;
  exportRequirements: {
    requiresAllShotsComplete: true;
    requiresContinuityPass: true;
    requiresAudioCrossfade: true;
    requiresColorMatch: true;
    requiresFinalMp4Proof: true;
  };
};

function buildShotCheck(shot: PlannedLongVideoShot): ShotContinuityCheck {
  return {
    shotId: shot.id,
    status: "needs_output",
    checks: [
      "identity consistency",
      "wardrobe consistency",
      "face consistency",
      "hand/gesture quality",
      "motion continuity",
      "lighting continuity",
      "camera continuity",
      "audio/dialogue sync",
      "caption/translation timing",
    ],
  };
}

export function buildLongVideoContinuityPlan(plan: LongVideoProductionPlan): LongVideoContinuityPlan {
  return {
    projectId: plan.projectId,
    status: "planned",
    shotChecks: plan.shots.map(buildShotCheck),
    stitchOrder: plan.shots.map((shot) => shot.id),
    seamRepairSteps: plan.shots.slice(0, -1).map((shot, index) => ({
      between: [shot.id, plan.shots[index + 1].id],
      required: [
        "pre-roll frame match",
        "post-roll frame match",
        "audio crossfade",
        "color/exposure match",
        "camera motion smoothing",
        "subject position continuity",
      ],
    })),
    exportRequirements: {
      requiresAllShotsComplete: true,
      requiresContinuityPass: true,
      requiresAudioCrossfade: true,
      requiresColorMatch: true,
      requiresFinalMp4Proof: true,
    },
  };
}
