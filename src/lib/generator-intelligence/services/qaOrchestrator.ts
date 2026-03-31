import type { StructuralScore } from "./structuralScoring";
import type { MotionPlan } from "../types";

export interface QaPass {
  label: string;
  passed: boolean;
  note: string;
}

export interface QaOrchestrationResult {
  shouldAutoReview: boolean;
  shouldRetry: boolean;
  reasons: string[];
  passes: QaPass[];
}

export function buildQaOrchestration(input: {
  medium: "image" | "video" | "song" | "script" | "voice";
  structuralScore?: StructuralScore;
  motionPlan?: MotionPlan;
  hasStoryBible: boolean;
}): QaOrchestrationResult {
  const passes: QaPass[] = [];
  const reasons: string[] = [];

  if (input.structuralScore) {
    passes.push({ label: "Structural realism", passed: input.structuralScore.realismScore >= 85, note: `Score ${input.structuralScore.realismScore}/100` });
    passes.push({ label: "Face integrity", passed: input.structuralScore.faceIntegrity >= 85, note: `Face ${input.structuralScore.faceIntegrity}/100` });
    passes.push({ label: "Body integrity", passed: input.structuralScore.bodyIntegrity >= 85, note: `Body ${input.structuralScore.bodyIntegrity}/100` });
    if (input.structuralScore.realismScore < 85) reasons.push("Structural realism below safe threshold.");
  }

  if (input.medium === "video") {
    passes.push({ label: "Story lock", passed: input.hasStoryBible, note: input.hasStoryBible ? "Story bible attached." : "Story bible missing." });
    if (!input.hasStoryBible) reasons.push("Video generation should not run without a story bible.");
    if (input.motionPlan) {
      const safeMotion = input.motionPlan.complexity === "minimal" || input.motionPlan.complexity === "low";
      passes.push({ label: "Motion safety", passed: safeMotion, note: `Motion complexity: ${input.motionPlan.complexity}` });
      if (!safeMotion) reasons.push("Motion complexity is higher than ideal for realism-first generation.");
    }
  }

  return {
    shouldAutoReview: true,
    shouldRetry: reasons.length > 0,
    reasons,
    passes,
  };
}
