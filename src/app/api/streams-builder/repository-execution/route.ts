import { after, type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { processBestRepositoryExecutionJob } from "@/lib/streams-builder/repository-worker-best";
import {
  createRepositoryExecutionPlan,
  type StreamsRepositoryExecutionCommand,
} from "@/lib/streams-builder/repository-execution";
import { createSandboxCommandBatch } from "@/lib/streams-builder/sandbox-commands";
import { resolveVisualEditIntent } from "@/lib/streams-builder/visual-edit-intent-resolver";
import { recordBuilderSystemEvent } from "@/lib/streams-builder/system-events";

const jobs = new StreamsAIJobsRepository();

function defaultRepositoryCommands(targetFiles?: string[]): StreamsRepositoryExecutionCommand[] {
  return targetFiles?.length
    ? ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"]
    : ["clone_repo", "npm_run_build", "git_status", "git_diff"];
}

function looksLikeUuid(value?: string | null) {
  return Boolean(value && value.length === 36 && value.includes("-") && value.split("-").length === 5);
}

function cleanRoute(value?: string | null) {
  const route = (value || "/").trim().replace(/[.,;:!?]+$/g, "");
  return route.startsWith("/") ? route : `/${route}`;
}

async function event(input: { sessionId?: string; phase: string; message: string; severity?: "info" | "warning" | "error"; repo?: string; branch?: string; filePath?: string; route?: string; status?: string; error?: string; metadata?: Record<string, unknown> }) {
  await recordBuilderSystemEvent({
    sessionId: input.sessionId || "agent-1",
    source: "repository-execution-route",
    phase: input.phase,
    message: input.message,
    severity: input.severity || "info",
    repo: input.repo,
    branch: input.branch,
    filePath: input.filePath,
    route: input.route,
    status: input.status,
    error: input.error,
    metadata: input.metadata,
  });
}

export async function POST(request: NextRequest) {
  let sessionId = "agent-1";
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      projectId?: string;
      sessionId?: string;
      repoFullName?: string;
      branchName?: string;
      baseBranch?: string;
      route?: string;
      userPrompt?: string;
      requestedCommands?: StreamsRepositoryExecutionCommand[];
      targetFiles?: string[];
      unifiedDiff?: string;
      commitMessage?: string;
      approvalGranted?: boolean;
      enqueue?: boolean;
      autoRunWorker?: boolean;
      autonomousRepair?: boolean;
      maxRepairAttempts?: number;
      maxFilesTouched?: number;
      runBuildAfterPatch?: boolean;
      requireApprovalBeforePush?: boolean;
      repairUnifiedDiffs?: string[];
    }>(request);

    sessionId = body.sessionId || "builder-session-pending";
    const visualIntent = resolveVisualEditIntent(body.userPrompt || "", {
      repo: body.repoFullName,
      branch: body.branchName,
      path: body.targetFiles?.[0],
      route: body.route,
    });
    const resolvedRepo = visualIntent.repo || body.repoFullName || "";
    const resolvedBranch = visualIntent.branch || body.branchName;
    const resolvedBaseBranch = visualIntent.branch || body.baseBranch;
    const resolvedRoute = cleanRoute(visualIntent.route || body.route || "/");
    const resolvedTargetFiles = visualIntent.path ? [visualIntent.path] : body.targetFiles;
    const resolvedPrompt = visualIntent.enrichedPrompt || body.userPrompt || "";
    const firstFile = resolvedTargetFiles?.[0] || "";

    await event({ sessionId, phase: "repository-execution-started", message: `Repository execution started for ${resolvedRepo || "unknown repo"}.`, repo: resolvedRepo, branch: resolvedBranch, filePath: firstFile, route: resolvedRoute });

    const requestedCommands = body.requestedCommands || defaultRepositoryCommands(resolvedTargetFiles);
    const projectId = body.projectId || scope.defaultProjectId || "project-pending";
    const dbProjectId = looksLikeUuid(projectId) ? projectId : null;
    const dbSessionId = looksLikeUuid(body.sessionId) ? body.sessionId || null : null;

    const plan = createRepositoryExecutionPlan({
      projectId,
      sessionId,
      repoFullName: resolvedRepo,
      branchName: resolvedBranch,
      baseBranch: resolvedBaseBranch,
      requestedCommands,
      targetFiles: resolvedTargetFiles,
      unifiedDiff: body.unifiedDiff,
      commitMessage: body.commitMessage,
      autonomousRepair: body.autonomousRepair === true,
      maxRepairAttempts: body.maxRepairAttempts,
      maxFilesTouched: body.maxFilesTouched,
      runBuildAfterPatch: body.runBuildAfterPatch,
      requireApprovalBeforePush: body.requireApprovalBeforePush !== false,
    });

    if (plan.blockedReasons.length > 0) {
      await event({ sessionId, phase: "repository-execution-blocked", message: `Repository execution blocked: ${plan.blockedReasons.join("; ")}`, severity: "warning", repo: resolvedRepo, branch: resolvedBranch, filePath: firstFile, route: resolvedRoute, status: "blocked", metadata: { blockedReasons: plan.blockedReasons } });
    }

    const sandboxBatch =
      plan.blockedReasons.length === 0
        ? createSandboxCommandBatch({
            projectId: plan.projectId,
            sessionId: plan.sessionId,
            repoFullName: plan.repoFullName,
            branchName: plan.branchName,
            commands: requestedCommands,
            targetFiles: resolvedTargetFiles,
            commitMessage: body.commitMessage,
          })
        : null;

    const queuedJob =
      body.enqueue === true && plan.blockedReasons.length === 0
        ? await jobs.create(scope, {
            projectId: dbProjectId,
            sessionId: dbSessionId,
            kind: "repository_execution",
            status: "queued",
            inputJson: {
              projectId,
              sessionId,
              repoFullName: plan.repoFullName,
              branchName: plan.branchName,
              baseBranch: plan.baseBranch,
              route: resolvedRoute,
              userPrompt: resolvedPrompt,
              requestedCommands,
              targetFiles: resolvedTargetFiles || [],
              unifiedDiff: body.unifiedDiff || "",
              commitMessage: body.commitMessage || "",
              approvalGranted: body.approvalGranted === true,
              autonomousRepair: body.autonomousRepair === true,
              maxRepairAttempts: plan.codexRepair.maxRepairAttempts,
              maxFilesTouched: plan.codexRepair.maxFilesTouched,
              runBuildAfterPatch: plan.codexRepair.runBuildAfterPatch,
              requireApprovalBeforePush: true,
              repairUnifiedDiffs: body.repairUnifiedDiffs || [],
              visualIntent,
              plan,
              sandboxBatch,
            },
          })
        : null;

    if (queuedJob) {
      await event({ sessionId, phase: "repository-execution-queued", message: `Repository execution job queued: ${queuedJob.id}.`, repo: plan.repoFullName, branch: plan.branchName, filePath: firstFile, route: resolvedRoute, status: "queued", metadata: { jobId: queuedJob.id } });
    }

    if (queuedJob && body.autoRunWorker !== false) {
      after(async () => {
        try {
          await jobs.createEvent(scope, {
            jobId: String(queuedJob.id),
            eventType: visualIntent.matched ? "repository.visual_intent.resolved" : "repository.worker.autorun.scheduled",
            message: visualIntent.matched ? visualIntent.reason : "Repository worker auto-run scheduled after queueing",
            data: visualIntent.matched ? { visualIntent } : { source: "repository-execution-route" },
          });
          await event({ sessionId, phase: "repository-worker-autorun-started", message: `Repository worker auto-run started for job ${queuedJob.id}.`, repo: plan.repoFullName, branch: plan.branchName, filePath: firstFile, route: resolvedRoute, status: "running", metadata: { jobId: queuedJob.id } });
          await processBestRepositoryExecutionJob(scope, queuedJob as Record<string, unknown>, jobs);
          await event({ sessionId, phase: "repository-worker-autorun-finished", message: `Repository worker auto-run finished for job ${queuedJob.id}.`, repo: plan.repoFullName, branch: plan.branchName, filePath: firstFile, route: resolvedRoute, status: "finished", metadata: { jobId: queuedJob.id } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Repository worker auto-run failed";
          await jobs.createEvent(scope, {
            jobId: String(queuedJob.id),
            eventType: "repository.worker.autorun.failed",
            message,
            data: { source: "repository-execution-route" },
          });
          await event({ sessionId, phase: "repository-worker-autorun-failed", message, severity: "error", repo: plan.repoFullName, branch: plan.branchName, filePath: firstFile, route: resolvedRoute, status: "failed", error: message, metadata: { jobId: queuedJob.id } });
        }
      });
    }

    return streamsAIJson({
      ok: plan.blockedReasons.length === 0,
      mode: queuedJob ? "repository_execution_queued" : "repository_execution_plan",
      message:
        plan.blockedReasons.length > 0
          ? "Repository execution plan blocked by validation."
          : queuedJob
            ? "Repository execution job queued for worker claim."
            : "Repository execution plan and sandbox command batch created. Set enqueue=true to queue worker execution.",
      scope: { tenantId: scope.tenantId, userId: scope.userId, workspaceId: scope.workspaceId },
      visualIntent,
      plan,
      sandboxBatch,
      queuedJob,
      autoRunWorker: Boolean(queuedJob && body.autoRunWorker !== false),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repository execution failed.";
    await event({ sessionId, phase: "repository-execution-failed", message, severity: "error", status: "failed", error: message });
    return streamsAIError(error);
  }
}
