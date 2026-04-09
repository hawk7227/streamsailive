import { runFlux, runRunway } from "./executors/falExecutor";

export async function runSteps(plan: any) {
  let images: any[] = [];
  let video: any = null;

  for (const step of plan.steps) {
    if (step === "generate base images") {
      images = await runFlux(plan);
    }
    if (step === "apply motion") {
      video = await runRunway(plan);
    }
  }

  return { images, video };
}
