import { GenerationPlan, ToolMode } from "./types";
import { selectTools } from "./toolRegistry";

export function generatePlan({
  prompt,
  analysis,
  mode,
}: {
  prompt: string;
  analysis?: unknown;
  mode: ToolMode;
}): GenerationPlan {
  const tools = selectTools(mode);

  return {
    intent: "PLAN_VIDEO",
    duration: 30,
    buildStrategy: "image_to_video",
    tools,
    steps: ["generate base images", "apply motion", "generate audio", "stitch"],
    costEstimate: { low: 0.12, high: 0.45 },
    prompt,
    analysis,
  };
}

export function validatePlan(plan: GenerationPlan): boolean {
  return !!(plan.intent && plan.tools?.length && plan.steps?.length && plan.costEstimate);
}
