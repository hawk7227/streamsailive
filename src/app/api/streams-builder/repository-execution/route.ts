import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import {
  createRepositoryExecutionPlan,
  type StreamsRepositoryExecutionCommand,
} from "@/lib/streams-builder/repository-execution";
import { createSandboxCommandBatch } from "@/lib/streams-builder/sandbox-commands";

const jobs = new StreamsAIJobsRepository();

function defaultRepositoryCommands(targetFiles?: string[]): StreamsRepositoryExecutionCommand[] {
  return targetFiles?.length
    ? ["clone_repo", "read_full_file", "git_status", "git_diff"]
    : ["clone_repo", "git_status", "git_diff"];
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
      requestedCommands?: StreamsRepositoryExecutionCommand[];
      targetFiles?: string[];
      unifiedDiff?: string;
      commitMessage?: string;
      approvalGranted?: boolean;
      enqueue?: boolean;
    }>(request);

    const requestedCommands = body.requestedCommands || defaultRepositoryCommands(body.targetFiles);
    const projectId = body.projectId || scope.defaultProjectId || "project-pending";
    const sessionId = body.sessionId || "builder-session-pending";

    const plan = createRepositoryExecutionPlan({
      projectId,
      sessionId,
      repoFullName: body.repoFullName || "",
      branchName: body.branchName,
      baseBranch: body.baseBranch,
      requestedCommands,
      targetFiles: body.targetFiles,
      unifiedDiff: body.unifiedDiff,
      commitMessage: body.commitMessage,
    });

    const sandboxBatch =
      plan.blockedReasons.length === 0
        ? createSandboxCommandBatch({
            projectId: plan.projectId,
            sessionId: plan.sessionId,
            repoFullName: plan.repoFullName,
            branchName: plan.branchName,
            commands: requestedCommands,
            targetFiles: body.targetFiles,
            commitMessage: body.commitMessage,
          })
        : null;

    const queuedJob =
      body.enqueue === true && plan.blockedReasons.length === 0
        ? await jobs.create(scope, {
            projectId,
            sessionId,
            kind: "repository_execution",
            status: "queued",
            inputJson: {
              projectId,
              sessionId,
              repoFullName: plan.repoFullName,
              branchName: plan.branchName,
              baseBranch: plan.baseBranch,
              requestedCommands,
              targetFiles: body.targetFiles || [],
              unifiedDiff: body.unifiedDiff || "",
              commitMessage: body.commitMessage || "",
              approvalGranted: body.approvalGranted === true,
              plan,
              sandboxBatch,
            },
          })
        : null;

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
      plan,
      sandboxBatch,
      queuedJob,
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
