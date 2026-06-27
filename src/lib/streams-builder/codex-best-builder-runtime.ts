import {
  createIPhoneBestBuilderPrompt,
  createStreamsCodexBuilderGoal,
  createStreamsCodexBuilderRun,
  validateStreamsCodexBestBuilderReadiness,
  type StreamsCodexBuilderGoal,
} from "./codex-best-builder-orchestrator";
import { buildLiveProofTimeline, createDiffApprovalState } from "./codex-builder-reliability";
import type { StreamsRepositoryExecutionCommand } from "./repository-execution";

export type StreamsCodexBestBuilderRuntimeInput = {
  userPrompt?: string;
  repoFullName: string;
  branchName: string;
  route?: string;
  targetFiles: string[];
  requestedCommands: StreamsRepositoryExecutionCommand[];
  autonomousRepair: boolean;
  maxRepairAttempts: number;
  requireApprovalBeforePush: boolean;
};

export type StreamsCodexCommandRuntimePolicy = {
  command: StreamsRepositoryExecutionCommand;
  risk: "safe" | "sandboxed" | "approval_required" | "blocked";
  allowedAutomatically: boolean;
  requiresApproval: boolean;
  reason: string;
};

export type StreamsCodexBestBuilderRuntimeMetadata = {
  enabled: boolean;
  goal: StreamsCodexBuilderGoal;
  readiness: ReturnType<typeof validateStreamsCodexBestBuilderReadiness>;
  proofTimeline: ReturnType<typeof buildLiveProofTimeline>;
  commandPolicies: StreamsCodexCommandRuntimePolicy[];
  diffApproval: ReturnType<typeof createDiffApprovalState>;
  requiredCapabilities: string[];
  iPhonePrompt: string;
};

export function classifyRepositoryCommandPolicy(command: StreamsRepositoryExecutionCommand): StreamsCodexCommandRuntimePolicy {
  if (command === "git_add_specific_file" || command === "git_commit" || command === "git_push") {
    return { command, risk: "approval_required", allowedAutomatically: false, requiresApproval: true, reason: "Repository write command requires explicit user approval." };
  }
  if (command === "clone_repo" || command === "read_full_file" || command === "git_status" || command === "git_diff") {
    return { command, risk: "safe", allowedAutomatically: true, requiresApproval: false, reason: "Source truth or read-only repository command." };
  }
  return { command, risk: "sandboxed", allowedAutomatically: true, requiresApproval: false, reason: "Build or patch command is allowed only inside the isolated worker." };
}

export function createBestBuilderRuntimeMetadata(input: StreamsCodexBestBuilderRuntimeInput): StreamsCodexBestBuilderRuntimeMetadata {
  const filePath = input.targetFiles[0] || "src/app/streams-ai/page.tsx";
  const userPrompt = input.userPrompt || `Fix this page and make it look like the screenshot in repo ${input.repoFullName} branch ${input.branchName} file ${filePath} route ${input.route || "/"}`;
  const goal = createStreamsCodexBuilderGoal({
    userPrompt,
    repo: input.repoFullName,
    branch: input.branchName,
    filePath,
    route: input.route || "/",
    screenshotAttached: /screenshot|image|attached/i.test(userPrompt),
    selectedElementKnown: /this page|selected|this section|this image|this panel/i.test(userPrompt),
  });
  const run = createStreamsCodexBuilderRun(goal);
  const commandPolicies = input.requestedCommands.map((command) => classifyRepositoryCommandPolicy(command));
  const diffApproval = createDiffApprovalState({
    changedFiles: input.targetFiles,
    changedLineCount: 0,
    buildPassed: false,
    browserVerified: false,
    approvalRequired: input.requireApprovalBeforePush,
  });

  return {
    enabled: true,
    goal,
    readiness: validateStreamsCodexBestBuilderReadiness(run),
    proofTimeline: run.proofTimeline,
    commandPolicies,
    diffApproval,
    requiredCapabilities: run.capabilities.map((capability) => `${capability.id}. ${capability.label}`),
    iPhonePrompt: createIPhoneBestBuilderPrompt(goal),
  };
}
