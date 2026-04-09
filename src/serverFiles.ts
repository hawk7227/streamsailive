import { runSteps } from "./stepRunner";

export async function runExecution(plan: any) {
  return runSteps(plan);
}
