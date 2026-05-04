import { createBuildTask, createProofReport } from "./build-task-service";
import { evaluateFullBuildGate } from "./build-quality-gate";

export function runBuildRuntimeSelfTests() {
  const passCases: string[] = [];
  const failCases: string[] = [];

  const layoutOnly = createBuildTask({ prompt: "layout only", activeSlice: "general-builder", projectProfile: "streams_self_build" });
  if (evaluateFullBuildGate(layoutOnly, [], []).passed) passCases.push("layout-only-explicit"); else failCases.push("layout-only-explicit");

  const overclaim = createBuildTask({ prompt: "build editor", activeSlice: "general-builder", projectProfile: "streams_self_build" });
  overclaim.classification = "Proven";
  if (!evaluateFullBuildGate(overclaim, [], []).passed) passCases.push("proven-overclaim-fails"); else failCases.push("proven-overclaim-fails");

  const report = createProofReport(overclaim.id);
  return { passCases, failCases, sampleProof: report };
}
