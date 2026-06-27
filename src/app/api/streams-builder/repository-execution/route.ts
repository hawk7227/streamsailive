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

export async function POST(request: NextRequest) {
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

    const requestedCommands = body.requestedCommands || defaultRepositoryCommands(resolvedTargetFiles);
    const projectId = body.projectId || scope.defaultProjectId || "project-pending";
    const sessionId = body.sessionId || "builder-session-pending";
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
      requireApprovalBeforePush: body.requireApprovalBeforePush,
    });

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
              requireApprovalBeforePush: plan.codexRepair.requireApprovalBeforePush,
              repairUnifiedDiffs: body.repairUnifiedDiffs || [],
              visualIntent,
              plan,
              sandboxBatch,
            },
          })
        : null;

    if (queuedJob && body.autoRunWorker !== false) {
      after(async () => {
        try {
          await jobs.createEvent(scope, {
            jobId: String(queuedJob.id),
            eventType: visualIntent.matched ? "repository.visual_intent.resolved" : "repository.worker.autorun.scheduled",
            message: visualIntent.matched ? visualIntent.reason : "Repository worker auto-run scheduled after queueing",
            data: visualIntent.matched ? { visualIntent } : { source: "repository-execution-route" },
          });
          await processBestRepositoryExecutionJob(scope, queuedJob as Record<string, unknown>, jobs);
        } catch (error) {
          await jobs.createEvent(scope, {
            jobId: String(queuedJob.id),
            eventType: "repository.worker.autorun.failed",
            message: error instanceof Error ? error.message : "Repository worker auto-run failed",
            data: { source: "repository-execution-route" },
          });
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
      scope: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        workspaceId: scope.workspaceId,
      },
      visualIntent,
      plan,
      sandboxBatch,
      queuedJob,
      autoRunWorker: Boolean(queuedJob && body.autoRunWorker !== false),
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
