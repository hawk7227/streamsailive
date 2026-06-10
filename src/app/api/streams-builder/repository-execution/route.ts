import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import {
  createRepositoryExecutionPlan,
  type StreamsRepositoryExecutionCommand,
} from "@/lib/streams-builder/repository-execution";

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

    const plan = createRepositoryExecutionPlan({
      projectId: body.projectId || scope.defaultProjectId || "project-pending",
      sessionId: body.sessionId || "builder-session-pending",
      repoFullName: body.repoFullName || "",
      branchName: body.branchName,
      baseBranch: body.baseBranch,
      requestedCommands: body.requestedCommands || [
        "clone_repo",
        "read_full_file",
        "git_status",
        "git_diff",
      ],
      targetFiles: body.targetFiles,
      unifiedDiff: body.unifiedDiff,
      commitMessage: body.commitMessage,
    });

    return streamsAIJson({
      ok: plan.blockedReasons.length === 0,
      mode: "repository_execution_plan",
      message:
        plan.blockedReasons.length === 0
          ? "Repository execution plan created. Sandbox execution is not wired in this endpoint yet."
          : "Repository execution plan blocked by validation.",
      scope: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        workspaceId: scope.workspaceId,
      },
      plan,
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
