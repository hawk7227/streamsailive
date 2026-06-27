import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createBestBuilderRuntimeMetadata } from "@/lib/streams-builder/codex-best-builder-runtime";
import type { StreamsRepositoryExecutionCommand } from "@/lib/streams-builder/repository-execution";

function defaultCommands(): StreamsRepositoryExecutionCommand[] {
  return ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"];
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      userPrompt?: string;
      repoFullName?: string;
      branchName?: string;
      route?: string;
      targetFiles?: string[];
      requestedCommands?: StreamsRepositoryExecutionCommand[];
      autonomousRepair?: boolean;
      maxRepairAttempts?: number;
      requireApprovalBeforePush?: boolean;
    }>(request);

    const metadata = createBestBuilderRuntimeMetadata({
      userPrompt: body.userPrompt,
      repoFullName: body.repoFullName || "hawk7227/streamsailive",
      branchName: body.branchName || "main",
      route: body.route || "/streams-ai/streams-builder",
      targetFiles: body.targetFiles?.length ? body.targetFiles : ["src/app/streams-ai/page.tsx"],
      requestedCommands: body.requestedCommands?.length ? body.requestedCommands : defaultCommands(),
      autonomousRepair: body.autonomousRepair !== false,
      maxRepairAttempts: body.maxRepairAttempts || 3,
      requireApprovalBeforePush: body.requireApprovalBeforePush !== false,
    });

    return streamsAIJson({
      ok: true,
      mode: "codex_best_builder_plan",
      scope: { tenantId: scope.tenantId, userId: scope.userId, workspaceId: scope.workspaceId },
      metadata,
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
