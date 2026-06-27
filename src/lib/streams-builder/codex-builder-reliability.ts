export type CodexCommandRisk = "safe" | "sandboxed" | "approval_required" | "blocked";

export type CodexLifecycleState =
  | "REQUEST_RECEIVED"
  | "SOURCE_TRUTH_READY"
  | "SANDBOX_READY"
  | "BUILD_RUNNING"
  | "BUILD_FAILED"
  | "REPAIR_CLASSIFIED"
  | "REPAIR_PATCH_GENERATED"
  | "REPAIR_PATCH_APPLIED"
  | "BUILD_RERUNNING"
  | "BUILD_PASSED"
  | "BROWSER_VERIFYING"
  | "BROWSER_VERIFIED"
  | "DIFF_AWAITING_APPROVAL"
  | "APPROVED_FOR_PUSH"
  | "PUSH_BLOCKED"
  | "ROLLBACK_READY"
  | "FAILED";

export type CodexProofSeverity = "info" | "success" | "warning" | "error";

export type CodexProofEvent = {
  id: string;
  state: CodexLifecycleState;
  message: string;
  severity: CodexProofSeverity;
  at: string;
  data?: Record<string, unknown>;
};

export type CodexCommandRiskDecision = {
  command: string;
  risk: CodexCommandRisk;
  allowedAutomatically: boolean;
  requiresApproval: boolean;
  blocked: boolean;
  reason: string;
};

export type CodexRepairLifecycle = {
  state: CodexLifecycleState;
  previousStates: CodexLifecycleState[];
  proof: CodexProofEvent[];
};

export type CodexBrowserVerificationState = {
  enabled: boolean;
  route: string;
  status: "not_started" | "queued" | "running" | "passed" | "failed";
  requiredBeforeApproval: boolean;
  proofRequired: string[];
  lastError?: string;
};

export type CodexDiffApprovalState = {
  status: "not_ready" | "awaiting_approval" | "approved" | "rejected";
  changedFiles: string[];
  changedLineCount: number;
  buildPassed: boolean;
  browserVerified: boolean;
  approvalRequired: boolean;
  canPush: boolean;
  reason: string;
};

export type CodexRollbackCheckpointState = {
  checkpointId: string;
  repo: string;
  branch: string;
  files: string[];
  createdAt: string;
  status: "not_created" | "created" | "restore_ready" | "restored" | "failed";
  restoreCommand?: string;
};

const SAFE_COMMANDS = new Set([
  "git status",
  "git diff",
  "git diff --check",
  "git log",
  "cat",
  "sed",
  "grep",
  "rg",
  "ls",
  "pwd",
]);

const SANDBOXED_COMMANDS = new Set([
  "pnpm test",
  "pnpm build",
  "pnpm lint",
  "pnpm exec tsc --noEmit",
  "npx tsc --noEmit",
  "npm run build",
  "npm test",
  "git apply --check",
  "git apply",
]);

const APPROVAL_COMMANDS = new Set([
  "git add",
  "git commit",
  "git push",
  "gh pr create",
  "gh pr merge",
]);

const BLOCKED_PATTERNS = [
  /git\s+add\s+\./i,
  /rm\s+-rf\s+\//i,
  /sudo\b/i,
  /curl\b.*\|\s*(sh|bash)/i,
  /wget\b.*\|\s*(sh|bash)/i,
  /chmod\s+777/i,
  /delete\s+from\s+/i,
  /drop\s+table/i,
];

function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, " ");
}

function commandStartsWithAny(command: string, prefixes: Set<string>) {
  return Array.from(prefixes).some((prefix) => command === prefix || command.startsWith(`${prefix} `));
}

export function classifyCodexCommandRisk(command: string): CodexCommandRiskDecision {
  const normalized = normalizeCommand(command);
  if (!normalized) {
    return { command, risk: "blocked", allowedAutomatically: false, requiresApproval: false, blocked: true, reason: "Empty command is blocked." };
  }

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { command, risk: "blocked", allowedAutomatically: false, requiresApproval: false, blocked: true, reason: "Command matches blocked/destructive pattern." };
  }

  if (commandStartsWithAny(normalized, APPROVAL_COMMANDS)) {
    return { command, risk: "approval_required", allowedAutomatically: false, requiresApproval: true, blocked: false, reason: "Repository write/push command requires explicit user approval." };
  }

  if (commandStartsWithAny(normalized, SANDBOXED_COMMANDS)) {
    return { command, risk: "sandboxed", allowedAutomatically: true, requiresApproval: false, blocked: false, reason: "Command may run automatically inside isolated sandbox." };
  }

  if (commandStartsWithAny(normalized, SAFE_COMMANDS)) {
    return { command, risk: "safe", allowedAutomatically: true, requiresApproval: false, blocked: false, reason: "Read-only/source inspection command is safe." };
  }

  return { command, risk: "approval_required", allowedAutomatically: false, requiresApproval: true, blocked: false, reason: "Unknown command requires approval before execution." };
}

export function createCodexProofEvent(state: CodexLifecycleState, message: string, severity: CodexProofSeverity = "info", data?: Record<string, unknown>): CodexProofEvent {
  return {
    id: `${state.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    state,
    message,
    severity,
    at: new Date().toISOString(),
    data,
  };
}

export function createCodexRepairLifecycle(): CodexRepairLifecycle {
  return {
    state: "REQUEST_RECEIVED",
    previousStates: [],
    proof: [createCodexProofEvent("REQUEST_RECEIVED", "Codex builder request received.")],
  };
}

export function transitionCodexLifecycle(lifecycle: CodexRepairLifecycle, nextState: CodexLifecycleState, message: string, severity: CodexProofSeverity = "info", data?: Record<string, unknown>): CodexRepairLifecycle {
  return {
    state: nextState,
    previousStates: [...lifecycle.previousStates, lifecycle.state],
    proof: [...lifecycle.proof, createCodexProofEvent(nextState, message, severity, data)],
  };
}

export function createBrowserVerificationHook(input: { route: string; enabled?: boolean; requiredBeforeApproval?: boolean }): CodexBrowserVerificationState {
  const route = input.route?.startsWith("/") ? input.route : `/${input.route || ""}`;
  return {
    enabled: input.enabled !== false,
    route,
    status: input.enabled === false ? "not_started" : "queued",
    requiredBeforeApproval: input.requiredBeforeApproval !== false,
    proofRequired: ["route loaded", "runtime page responded", "no browser error captured", "visual preview available for user review"],
  };
}

export function resolveBrowserVerification(state: CodexBrowserVerificationState, result: { ok: boolean; error?: string }): CodexBrowserVerificationState {
  return {
    ...state,
    status: result.ok ? "passed" : "failed",
    lastError: result.ok ? undefined : result.error || "Browser verification failed without a detailed error.",
  };
}

export function createDiffApprovalState(input: { changedFiles: string[]; changedLineCount: number; buildPassed: boolean; browserVerified: boolean; approvalRequired?: boolean }): CodexDiffApprovalState {
  const approvalRequired = input.approvalRequired !== false;
  const canPush = approvalRequired === false ? input.buildPassed && input.browserVerified : false;
  const reason = !input.buildPassed
    ? "Build must pass before approval."
    : !input.browserVerified
      ? "Browser verification must pass before approval."
      : approvalRequired
        ? "Awaiting explicit user approval before push."
        : "Approval not required by policy and proof passed.";

  return {
    status: input.changedFiles.length ? "awaiting_approval" : "not_ready",
    changedFiles: input.changedFiles,
    changedLineCount: input.changedLineCount,
    buildPassed: input.buildPassed,
    browserVerified: input.browserVerified,
    approvalRequired,
    canPush,
    reason,
  };
}

export function approveDiff(state: CodexDiffApprovalState): CodexDiffApprovalState {
  if (!state.buildPassed || !state.browserVerified) {
    return { ...state, status: "rejected", canPush: false, reason: "Cannot approve until build and browser verification pass." };
  }
  return { ...state, status: "approved", canPush: true, reason: "User approved diff after proof review." };
}

export function rejectDiff(state: CodexDiffApprovalState, reason = "User rejected diff."): CodexDiffApprovalState {
  return { ...state, status: "rejected", canPush: false, reason };
}

export function createRollbackCheckpoint(input: { repo: string; branch: string; files: string[]; checkpointId?: string }): CodexRollbackCheckpointState {
  const checkpointId = input.checkpointId || `checkpoint-${Date.now()}`;
  return {
    checkpointId,
    repo: input.repo,
    branch: input.branch,
    files: input.files,
    createdAt: new Date().toISOString(),
    status: "created",
    restoreCommand: `git checkout ${input.branch} -- ${input.files.join(" ")}`,
  };
}

export function markRollbackReady(checkpoint: CodexRollbackCheckpointState): CodexRollbackCheckpointState {
  return { ...checkpoint, status: "restore_ready" };
}

export function buildLiveProofTimeline(events: CodexProofEvent[]) {
  return events.map((event, index) => ({
    index: index + 1,
    state: event.state,
    severity: event.severity,
    message: event.message,
    at: event.at,
    data: event.data || {},
  }));
}

export function createNonConsolidatedCodexReliabilityPlan(input: { repo: string; branch: string; filePath: string; route: string }) {
  const lifecycle = createCodexRepairLifecycle();
  const checkpoint = createRollbackCheckpoint({ repo: input.repo, branch: input.branch, files: [input.filePath] });
  const browser = createBrowserVerificationHook({ route: input.route, enabled: true, requiredBeforeApproval: true });
  const approval = createDiffApprovalState({ changedFiles: [input.filePath], changedLineCount: 0, buildPassed: false, browserVerified: false, approvalRequired: true });

  return {
    manifest: "AGENTS.md Codex Builder Reliability Layer",
    lifecycle,
    commandPolicy: {
      build: classifyCodexCommandRisk("pnpm build"),
      test: classifyCodexCommandRisk("pnpm test"),
      push: classifyCodexCommandRisk("git push origin HEAD:main"),
      forbiddenAddDot: classifyCodexCommandRisk("git add ."),
    },
    checkpoint,
    browser,
    approval,
    proofTimeline: buildLiveProofTimeline(lifecycle.proof),
    userTestPrompt: `Agent 1, connect to Visual Editing and run a full Codex builder test on repo ${input.repo} branch ${input.branch} file ${input.filePath}. Pull real source truth, queue autonomousRepair true with maxRepairAttempts 3, run build/typecheck proof, repair only if a failure happens, rerun until green or attempts are exhausted, show every proof event in the workstation, do not commit, do not push, and stop at approval required.`,
  };
}
