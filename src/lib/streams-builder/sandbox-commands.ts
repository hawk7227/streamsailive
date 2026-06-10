import type { StreamsRepositoryExecutionCommand } from "./repository-execution";

export type StreamsSandboxCommandStatus = "queued" | "running" | "completed" | "failed" | "skipped";

export interface StreamsSandboxCommand {
  id: string;
  command: StreamsRepositoryExecutionCommand;
  cwd: string;
  args: string[];
  status: StreamsSandboxCommandStatus;
  requiresApproval: boolean;
  capturesStdout: boolean;
  capturesStderr: boolean;
  proofLabel: string;
}

export interface StreamsSandboxCommandBatch {
  batchId: string;
  projectId: string;
  sessionId: string;
  repoFullName: string;
  branchName: string;
  commands: StreamsSandboxCommand[];
}

function commandId(command: StreamsRepositoryExecutionCommand, index: number) {
  return `${String(index + 1).padStart(2, "0")}-${command.replaceAll("_", "-")}`;
}

export function createSandboxCommandBatch(input: {
  projectId: string;
  sessionId: string;
  repoFullName: string;
  branchName: string;
  workspaceDir?: string;
  commands: StreamsRepositoryExecutionCommand[];
  targetFiles?: string[];
  commitMessage?: string;
}): StreamsSandboxCommandBatch {
  const cwd = input.workspaceDir || `/tmp/streams-builder/${input.projectId}`;
  const firstTarget = input.targetFiles?.[0] || "";
  const commitMessage = input.commitMessage || "Streams Builder update";

  return {
    batchId: `sandbox-${input.projectId}-${Date.now()}`,
    projectId: input.projectId,
    sessionId: input.sessionId,
    repoFullName: input.repoFullName,
    branchName: input.branchName,
    commands: input.commands.map((command, index) => {
      const base = {
        id: commandId(command, index),
        command,
        cwd,
        status: "queued" as const,
        capturesStdout: true,
        capturesStderr: true,
      };

      switch (command) {
        case "clone_repo":
          return {
            ...base,
            args: ["git", "clone", `https://github.com/${input.repoFullName}.git`, cwd],
            requiresApproval: false,
            proofLabel: "Repository cloned into isolated sandbox.",
          };
        case "read_full_file":
          return {
            ...base,
            args: ["cat", firstTarget],
            requiresApproval: false,
            proofLabel: "Full target file content read before editing.",
          };
        case "apply_unified_diff":
          return {
            ...base,
            args: ["git", "apply", "--check", "PATCH_FILE_THEN_APPLY"],
            requiresApproval: false,
            proofLabel: "Unified diff validated before apply.",
          };
        case "npm_run_build":
          return {
            ...base,
            args: ["npm", "run", "build"],
            requiresApproval: false,
            proofLabel: "Build command completed and logs captured.",
          };
        case "git_status":
          return {
            ...base,
            args: ["git", "status", "--short"],
            requiresApproval: false,
            proofLabel: "Working tree status captured.",
          };
        case "git_diff":
          return {
            ...base,
            args: ["git", "diff", "--", ...(input.targetFiles || [])],
            requiresApproval: false,
            proofLabel: "Exact file diff captured.",
          };
        case "git_add_specific_file":
          return {
            ...base,
            args: ["git", "add", ...(input.targetFiles || [])],
            requiresApproval: true,
            proofLabel: "Only explicitly selected files staged. git add dot is forbidden.",
          };
        case "git_commit":
          return {
            ...base,
            args: ["git", "commit", "-m", commitMessage],
            requiresApproval: true,
            proofLabel: "Approved changes committed with explicit message.",
          };
        case "git_push":
          return {
            ...base,
            args: ["git", "push", "origin", input.branchName],
            requiresApproval: true,
            proofLabel: "Approved branch pushed to origin.",
          };
      }
    }),
  };
}
