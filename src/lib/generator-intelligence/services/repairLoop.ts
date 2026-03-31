import type { StructuralScore } from "./structuralScoring";

export interface RepairPlan {
  shouldRetry: boolean;
  maxAttempts: number;
  strategy: "region_repair" | "anchor_frame_prebuild" | "motion_reduction" | "regenerate_still" | "none";
  instructions: string[];
}

export function buildRepairPlan(score: StructuralScore, medium: "image" | "video" | "song" | "script" | "voice"): RepairPlan {
  if (medium === "song") {
    return { shouldRetry: false, maxAttempts: 0, strategy: "none", instructions: [] };
  }

  const instructions: string[] = [];
  let strategy: RepairPlan["strategy"] = "none";
  let shouldRetry = false;
  let maxAttempts = 0;

  if (!score.isSafeForVideo) {
    shouldRetry = true;
    maxAttempts = 3;
    strategy = score.faceIntegrity < 80 || score.bodyIntegrity < 80 ? "region_repair" : "motion_reduction";
    instructions.push("Repair only the weak region rather than regenerating the entire frame when possible.");
    instructions.push("Re-run structural scoring after every repair attempt.");
  }

  if (score.poseStability < 82) {
    strategy = "anchor_frame_prebuild";
    instructions.push("Create 3–5 anchor stills before video generation.");
  }

  if (score.backgroundIntegrity < 82) {
    instructions.push("Simplify or stabilize environment details before animation.");
  }

  if (score.faceIntegrity < 84) {
    instructions.push("Lock eye spacing, mouth shape, and jawline before motion.");
  }

  if (score.bodyIntegrity < 84) {
    instructions.push("Validate hands, wrists, elbows, and cropped limbs before approval.");
  }

  if (!instructions.length) {
    instructions.push("No repair required. Proceed with current asset.");
  }

  return { shouldRetry, maxAttempts, strategy, instructions };
}
