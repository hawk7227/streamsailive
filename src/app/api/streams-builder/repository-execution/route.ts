import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import {
  createRepositoryExecutionPlan,
  type StreamsRepositoryExecutionCommand,
} from "@/lib/streams-builder/repository-execution";
import { createSandboxCommandBatch } from "@/lib/streams-builder/sandbox-commands";

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
    }>(request);

    const requestedCommands = body.requestedCommands || [
      "clone_repo",
      "read_full_file",
      "git_status",
      "git_diff",
    ];

    const plan = createRepositoryExecutionPlan({
      projectId: body.projectId || scope.defaultProjectId || "project-pending",
      sessionId: body.sessionId || "builder-session-pending",
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

    return streamsAIJson({
      ok: plan.blockedReasons.length === 0,
      mode: "repository_execution_plan",
      message:
        plan.blockedReasons.length === 0
          ? "Repository execution plan and sandbox command batch created. Worker execution is not wired in this endpoint yet."
          : "Repository execution plan blocked by validation.",
      scope: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        workspaceId: scope.workspaceId,
      },
      plan,
      sandboxBatch,
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
