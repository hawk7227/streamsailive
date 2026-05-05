import type { BuildTask, ProofReport } from "./types";
export function buildProofReport(task: BuildTask): ProofReport {
  return {
    classification: task.classification,
    changedFiles: task.changedFiles,
    patchesApplied: task.patches,
    commandsRun: task.commandRuns,
    guardResults: task.checks.filter((c) => ["scope_guard", "generated_file_guard", "pr_ready"].includes(c.name)),
    blockedItems: task.blockedReason ? [task.blockedReason] : [],
    proofStillMissing: ["isolated workspace runner", "durable persistence", "github write path", "ci monitor", "browser proof runner"],
    generatedFilesRestored: [],
  };
}
