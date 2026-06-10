import type { StreamsBuilderTruthState } from "./types";

export type StreamsRepositoryExecutionCommand =
  | "clone_repo"
  | "read_full_file"
  | "apply_unified_diff"
  | "npm_run_build"
  | "git_status"
  | "git_diff"
  | "git_add_specific_file"
  | "git_commit"
  | "git_push";

export type StreamsRepositoryExecutionStage =
  | "queued"
  | "repo_access"
  | "sandbox_prepare"
  | "clone"
  | "inspect"
  | "checkpoint"
  | "patch"
  | "build"
  | "git_review"
  | "commit"
  | "push"
  | "proof_pending";

export interface StreamsRepositoryExecutionRequest {
  projectId: string;
  sessionId: string;
  repoFullName: string;
  branchName?: string;
  baseBranch?: string;
  requestedCommands: StreamsRepositoryExecutionCommand[];
  targetFiles?: string[];
  unifiedDiff?: string;
  commitMessage?: string;
}

export interface StreamsRepositoryExecutionStep {
  command: StreamsRepositoryExecutionCommand;
  stage: StreamsRepositoryExecutionStage;
  allowed: boolean;
  requiresSandbox: boolean;
  requiresCheckpoint: boolean;
  requiresApproval: boolean;
  truthState: StreamsBuilderTruthState;
  description: string;
}

export interface StreamsRepositoryExecutionPlan {
  projectId: string;
  sessionId: string;
  repoFullName: string;
  baseBranch: string;
  branchName: string;
  truthState: StreamsBuilderTruthState;
  steps: StreamsRepositoryExecutionStep[];
  blockedReasons: string[];
}

const ALLOWED_COMMANDS: StreamsRepositoryExecutionCommand[] = [
  "clone_repo",
  "read_full_file",
  "apply_unified_diff",
  "npm_run_build",
  "git_status",
  "git_diff",
  "git_add_specific_file",
  "git_commit",
  "git_push",
];

const COMMAND_DETAILS: Record<StreamsRepositoryExecutionCommand, Omit<StreamsRepositoryExecutionStep, "command">> = {
  clone_repo: {
    stage: "clone",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: false,
    truthState: "UNPROVEN",
    description: "Clone the selected repository into an isolated sandbox worker.",
  },
  read_full_file: {
    stage: "inspect",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: false,
    truthState: "UNPROVEN",
    description: "Read complete target files before patching so the AI does not edit blindly.",
  },
  apply_unified_diff: {
    stage: "patch",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: true,
    requiresApproval: false,
    truthState: "UNPROVEN",
    description: "Apply a controlled unified diff after a checkpoint exists.",
  },
  npm_run_build: {
    stage: "build",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: false,
    truthState: "UNPROVEN",
    description: "Run npm run build inside the sandbox and capture logs as proof evidence.",
  },
  git_status: {
    stage: "git_review",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: false,
    truthState: "UNPROVEN",
    description: "Inspect working tree status before staging specific files.",
  },
  git_diff: {
    stage: "git_review",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: false,
    truthState: "UNPROVEN",
    description: "Show the exact diff before commit or approval.",
  },
  git_add_specific_file: {
    stage: "commit",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: true,
    truthState: "UNPROVEN",
    description: "Stage only explicitly selected files. Never use git add dot.",
  },
  git_commit: {
    stage: "commit",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: true,
    truthState: "UNPROVEN",
    description: "Create a commit only after proof and approval requirements are satisfied.",
  },
  git_push: {
    stage: "push",
    allowed: true,
    requiresSandbox: true,
    requiresCheckpoint: false,
    requiresApproval: true,
    truthState: "UNPROVEN",
    description: "Push the approved branch after commit creation.",
  },
};

function isSafeRepoName(value: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function isSafeBranchName(value: string): boolean {
  return /^[A-Za-z0-9._/-]+$/.test(value) && !value.includes("..") && !value.startsWith("/");
}

function isSafeFilePath(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("..") && !value.includes("\\");
}

export function createRepositoryExecutionPlan(
  request: StreamsRepositoryExecutionRequest,
): StreamsRepositoryExecutionPlan {
  const blockedReasons: string[] = [];
  const baseBranch = request.baseBranch?.trim() || "main";
  const branchName = request.branchName?.trim() || `streams-builder/${request.projectId}`;

  if (!request.projectId.trim()) blockedReasons.push("projectId is required.");
  if (!request.sessionId.trim()) blockedReasons.push("sessionId is required.");
  if (!isSafeRepoName(request.repoFullName)) blockedReasons.push("repoFullName must be owner/name.");
  if (!isSafeBranchName(baseBranch)) blockedReasons.push("baseBranch is invalid.");
  if (!isSafeBranchName(branchName)) blockedReasons.push("branchName is invalid.");

  const targetFiles = request.targetFiles ?? [];
  for (const file of targetFiles) {
    if (!isSafeFilePath(file)) blockedReasons.push(`Unsafe file path: ${file}`);
  }

  const cloneIndex = request.requestedCommands.indexOf("clone_repo");
  const repositoryCommandIndex = request.requestedCommands.findIndex((command) => command !== "clone_repo");
  if (repositoryCommandIndex >= 0 && cloneIndex < 0) {
    blockedReasons.push("clone_repo is required before repository commands.");
  }
  if (cloneIndex > repositoryCommandIndex && repositoryCommandIndex >= 0) {
    blockedReasons.push("clone_repo must run before repository commands.");
  }

  if (request.requestedCommands.includes("read_full_file") && targetFiles.length === 0) {
    blockedReasons.push("targetFiles is required before read_full_file.");
  }

  if (request.requestedCommands.includes("git_add_specific_file") && targetFiles.length === 0) {
    blockedReasons.push("targetFiles is required before git_add_specific_file.");
  }

  if (request.requestedCommands.includes("apply_unified_diff") && !request.unifiedDiff?.trim()) {
    blockedReasons.push("unifiedDiff is required before apply_unified_diff.");
  }

  if (request.requestedCommands.includes("git_commit") && !request.commitMessage?.trim()) {
    blockedReasons.push("commitMessage is required before git_commit.");
  }

  const unknownCommands = request.requestedCommands.filter((command) => !ALLOWED_COMMANDS.includes(command));
  for (const command of unknownCommands) {
    blockedReasons.push(`Unsupported command: ${command}`);
  }

  const steps = request.requestedCommands
    .filter((command) => ALLOWED_COMMANDS.includes(command))
    .map((command) => ({ command, ...COMMAND_DETAILS[command] }));

  return {
    projectId: request.projectId,
    sessionId: request.sessionId,
    repoFullName: request.repoFullName,
    baseBranch,
    branchName,
    truthState: blockedReasons.length > 0 ? "FAILED" : "UNPROVEN",
    steps,
    blockedReasons,
  };
}
