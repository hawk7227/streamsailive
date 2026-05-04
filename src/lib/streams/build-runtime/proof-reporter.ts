import type { BuildTask, ProofReport } from "./types";
import { evaluateFullBuildGate } from "./build-quality-gate";
export function buildProofReport(task: BuildTask): ProofReport {
  const gate = evaluateFullBuildGate(task, task.checks, task.changedFiles);
  return {
    classification: gate.passed ? task.classification : "Blocked",
    changedFiles: task.changedFiles,
    patchesApplied: task.patches,
    commandsRun: task.commandRuns,
    guardResults: task.checks.filter((c) => ["scope_guard", "generated_file_guard", "pr_ready"].includes(c.name)),
    blockedItems: [...(task.blockedReason ? [task.blockedReason] : []), ...gate.failures],
    proofStillMissing: ["isolated workspace runner", "durable persistence", "github write path", "ci monitor", "browser proof runner", ...gate.nextActions],
    generatedFilesRestored: [],
  };
}
