import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import type { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import {
  buildLiveProofTimeline,
  createBrowserVerificationHook,
  createCodexRepairLifecycle,
  createDiffApprovalState,
  createRollbackCheckpoint,
  markRollbackReady,
  transitionCodexLifecycle,
  type CodexLifecycleState,
  type CodexProofSeverity,
} from "./codex-builder-reliability";
import { processRepositoryExecutionJob, type RepositoryWorkerResult } from "./repository-worker";

type WorkerRow = Record<string, unknown>;

function rowString(row: WorkerRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function rowStringArray(row: WorkerRow, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inputOf(row: WorkerRow) {
  return (row.input_json || {}) as WorkerRow;
}

export async function processBestRepositoryExecutionJob(scope: StreamsAIScope, row: WorkerRow, jobs: StreamsAIJobsRepository): Promise<RepositoryWorkerResult> {
  const jobId = String(row.id);
  const input = inputOf(row);
  const repo = rowString(input, "repoFullName");
  const branch = rowString(input, "branchName") || "main";
  const route = rowString(input, "route") || "/";
  const targetFiles = rowStringArray(input, "targetFiles");
  let lifecycle = createCodexRepairLifecycle();
  const rollback = markRollbackReady(createRollbackCheckpoint({ repo, branch, files: targetFiles.length ? targetFiles : ["unknown"] }));
  const browserVerification = createBrowserVerificationHook({ route, enabled: true, requiredBeforeApproval: true });

  async function emit(state: CodexLifecycleState, message: string, severity: CodexProofSeverity = "info", data?: Record<string, unknown>) {
    lifecycle = transitionCodexLifecycle(lifecycle, state, message, severity, data);
    await jobs.createEvent(scope, {
      jobId,
      eventType: `repository.best.lifecycle.${state.toLowerCase()}`,
      message,
      data: { state, severity, ...(data || {}) },
    });
  }

  await emit("REQUEST_RECEIVED", "Best-builder worker received job.", "info", { repo, branch, route, targetFiles });
  await emit("SOURCE_TRUTH_READY", "Source truth was resolved before worker execution.", "success", { repo, branch, route, targetFiles });
  await emit("SANDBOX_READY", "Worker will execute in an isolated repository sandbox.", "info");
  await emit("ROLLBACK_READY", "Rollback checkpoint is available before patch or repair.", "success", { checkpointId: rollback.checkpointId, restoreCommand: rollback.restoreCommand });

  const result = await processRepositoryExecutionJob(scope, row, jobs);
  const buildPassed = result.ok && result.truthState !== "FAILED";

  if (buildPassed) {
    await emit("BUILD_PASSED", "Worker completed build/repair command path without hard failure.", "success", { result });
    await emit("BROWSER_VERIFYING", "Browser verification hook is required before approval.", "warning", { route });
  } else {
    await emit("FAILED", "Worker finished with a failed or blocked result.", "error", { result });
  }

  const diffApproval = createDiffApprovalState({ changedFiles: targetFiles, changedLineCount: 0, buildPassed, browserVerified: false, approvalRequired: true });
  await emit("DIFF_AWAITING_APPROVAL", diffApproval.reason, "warning", { diffApproval });
  await emit("PUSH_BLOCKED", "Push is blocked until diff, browser proof, rollback proof, and explicit user approval are present.", "warning", { diffApproval });

  await jobs.update(scope, jobId, {
    metadata: {
      ...(row.metadata_json && typeof row.metadata_json === "object" ? row.metadata_json : {}),
      bestBuilderReliability: {
        proofTimeline: buildLiveProofTimeline(lifecycle.proof),
        rollback,
        browserVerification,
        diffApproval,
        result,
      },
    },
  });

  return result;
}
