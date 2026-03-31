import type { MotionPlan, ReferenceAnalysis } from "../types";

export function buildMotionPlan(input: {
  provider: string;
  mode?: string | null;
  hasStoryBible: boolean;
  referenceAnalysis: ReferenceAnalysis;
}): MotionPlan {
  const notes: string[] = [];
  const allowedMoves: string[] = [];
  const blockedMoves: string[] = [];

  let complexity: MotionPlan["complexity"] = "medium";
  if (!input.hasStoryBible || input.referenceAnalysis.referenceStrength === "none") {
    complexity = "minimal";
    notes.push("No locked story bible or references. Keep the scene simple.");
  } else if (input.referenceAnalysis.likelySingleStill || input.referenceAnalysis.anatomyRisk === "high") {
    complexity = "low";
    notes.push("Single-still or anatomy-risk references detected. Clamp movement range.");
  }

  let cameraStyle = "subtle handheld or gentle push-in";
  if (input.provider === "runway") {
    cameraStyle = complexity === "medium" ? "gentle dolly or restrained handheld" : "small push-in only";
  } else if (input.provider === "openai") {
    cameraStyle = complexity === "medium" ? "documentary handheld with mild drift" : "mostly locked frame with a light push-in";
  } else if (input.provider === "kling") {
    cameraStyle = complexity === "medium" ? "simple camera move with grounded subject motion" : "locked camera with only tiny subject movement";
  }

  allowedMoves.push("breathing", "blinking", "small posture shifts");
  if (complexity !== "minimal") allowedMoves.push("short walk-in", "slight head turn", "one grounded hand gesture");

  blockedMoves.push("fast spins", "full-body occlusion reveals", "aggressive running", "large camera orbit");
  if (input.referenceAnalysis.likelySingleStill) {
    blockedMoves.push("body turns beyond partial profile", "hidden-arm reveals", "complex hand choreography");
  }

  if (input.mode === "i2v") {
    notes.push("Image-to-video mode detected. Treat hidden anatomy as locked and avoid making the model invent unseen structure.");
  }

  return {
    complexity,
    cameraStyle,
    allowedMoves,
    blockedMoves,
    notes,
  };
}
