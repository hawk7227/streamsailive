import {
  approveDiff,
  buildLiveProofTimeline,
  classifyCodexCommandRisk,
  createBrowserVerificationHook,
  createCodexRepairLifecycle,
  createDiffApprovalState,
  createRollbackCheckpoint,
  markRollbackReady,
  resolveBrowserVerification,
  transitionCodexLifecycle,
  type CodexBrowserVerificationState,
  type CodexDiffApprovalState,
  type CodexProofEvent,
  type CodexRepairLifecycle,
  type CodexRollbackCheckpointState,
} from "./codex-builder-reliability";

export type StreamsCodexBuilderGoal = {
  userPrompt: string;
  repo: string;
  branch: string;
  route: string;
  filePath: string;
  screenshotAttached?: boolean;
  selectedElementKnown?: boolean;
};

export type StreamsCodexBuilderCapabilityProof = {
  id: number;
  label: string;
  implemented: boolean;
  proofState: "proven" | "implemented_unproven" | "blocked";
  proofRequired: string[];
};

export type StreamsCodexBuilderRunState = {
  goal: StreamsCodexBuilderGoal;
  lifecycle: CodexRepairLifecycle;
  checkpoint: CodexRollbackCheckpointState;
  browser: CodexBrowserVerificationState;
  approval: CodexDiffApprovalState;
  capabilities: StreamsCodexBuilderCapabilityProof[];
  proofTimeline: ReturnType<typeof buildLiveProofTimeline>;
  explanation: string[];
};

export const BEST_BUILDER_REQUIRED_CAPABILITIES: StreamsCodexBuilderCapabilityProof[] = [
  { id: 1, label: "understands selected page/route", implemented: true, proofState: "implemented_unproven", proofRequired: ["repo/branch/route/filePath extracted", "selected visual context when applicable"] },
  { id: 2, label: "finds the real files", implemented: true, proofState: "implemented_unproven", proofRequired: ["source truth pull from GitHub route", "target files recorded"] },
  { id: 3, label: "edits the code", implemented: true, proofState: "implemented_unproven", proofRequired: ["diff generated", "patch applied in sandbox"] },
  { id: 4, label: "previews the route", implemented: true, proofState: "implemented_unproven", proofRequired: ["browser verification hook queued", "route proof captured"] },
  { id: 5, label: "sees what broke", implemented: true, proofState: "implemented_unproven", proofRequired: ["stdout/stderr captured", "failure classified"] },
  { id: 6, label: "repairs automatically", implemented: true, proofState: "implemented_unproven", proofRequired: ["repair patch generated", "patch applied", "attempt count recorded"] },
  { id: 7, label: "reruns build/tests/browser checks", implemented: true, proofState: "implemented_unproven", proofRequired: ["failing command rerun", "browser verification run or queued"] },
  { id: 8, label: "shows diff and screenshot", implemented: true, proofState: "implemented_unproven", proofRequired: ["diff approval state", "browser/screenshot proof event"] },
  { id: 9, label: "asks for approval", implemented: true, proofState: "implemented_unproven", proofRequired: ["diff approval state awaiting approval"] },
  { id: 10, label: "pushes only after approval", implemented: true, proofState: "implemented_unproven", proofRequired: ["push command risk requires approval", "canPush false until approved"] },
  { id: 11, label: "can rollback", implemented: true, proofState: "implemented_unproven", proofRequired: ["rollback checkpoint", "restore command"] },
  { id: 12, label: "saves proof", implemented: true, proofState: "implemented_unproven", proofRequired: ["proof timeline stored on job metadata"] },
  { id: 13, label: "explains exactly what was done", implemented: true, proofState: "implemented_unproven", proofRequired: ["user-facing explanation generated from proof events"] },
];

export function createStreamsCodexBuilderGoal(input: Partial<StreamsCodexBuilderGoal> & Pick<StreamsCodexBuilderGoal, "userPrompt">): StreamsCodexBuilderGoal {
  const repoMatch = input.userPrompt.match(/repo\s+([\w.-]+\/[\w.-]+)/i)?.[1];
  const branchMatch = input.userPrompt.match(/branch\s+([\w./-]+)/i)?.[1];
  const fileMatch = input.userPrompt.match(/(src\/[\w./()\[\]-]+\.(?:tsx|jsx|ts|js))/i)?.[1];
  const routeMatch = input.userPrompt.match(/route\s+(\/[^\s]+)/i)?.[1];
  return {
    userPrompt: input.userPrompt,
    repo: input.repo || repoMatch || "hawk7227/streamsailive",
    branch: input.branch || branchMatch || "main",
    route: input.route || routeMatch || "/streams-ai",
    filePath: input.filePath || fileMatch || "src/app/streams-ai/page.tsx",
    screenshotAttached: input.screenshotAttached === true || /screenshot|image|attached/i.test(input.userPrompt),
    selectedElementKnown: input.selectedElementKnown === true || /this page|selected|this section|this image|this panel/i.test(input.userPrompt),
  };
}

export function createStreamsCodexBuilderRun(goal: StreamsCodexBuilderGoal): StreamsCodexBuilderRunState {
  let lifecycle = createCodexRepairLifecycle();
  lifecycle = transitionCodexLifecycle(lifecycle, "SOURCE_TRUTH_READY", `Source target resolved: ${goal.repo}@${goal.branch}:${goal.filePath}`, "success", { repo: goal.repo, branch: goal.branch, filePath: goal.filePath, route: goal.route });
  lifecycle = transitionCodexLifecycle(lifecycle, "SANDBOX_READY", "Sandbox/worktree required before edits can be applied.", "info");
  const checkpoint = markRollbackReady(createRollbackCheckpoint({ repo: goal.repo, branch: goal.branch, files: [goal.filePath] }));
  lifecycle = transitionCodexLifecycle(lifecycle, "ROLLBACK_READY", "Rollback checkpoint is ready before patch application.", "success", { checkpointId: checkpoint.checkpointId, restoreCommand: checkpoint.restoreCommand });
  const browser = createBrowserVerificationHook({ route: goal.route, enabled: true, requiredBeforeApproval: true });
  const approval = createDiffApprovalState({ changedFiles: [goal.filePath], changedLineCount: 0, buildPassed: false, browserVerified: false, approvalRequired: true });
  const proofTimeline = buildLiveProofTimeline(lifecycle.proof);
  return {
    goal,
    lifecycle,
    checkpoint,
    browser,
    approval,
    capabilities: BEST_BUILDER_REQUIRED_CAPABILITIES,
    proofTimeline,
    explanation: explainStreamsCodexBuilderRun(lifecycle.proof, approval, browser),
  };
}

export function markStreamsCodexBuildPassed(run: StreamsCodexBuilderRunState): StreamsCodexBuilderRunState {
  const lifecycle = transitionCodexLifecycle(run.lifecycle, "BUILD_PASSED", "Build/typecheck proof passed or rerun passed after repair.", "success");
  const browser = { ...run.browser, status: "queued" as const };
  const approval = createDiffApprovalState({ changedFiles: [run.goal.filePath], changedLineCount: run.approval.changedLineCount, buildPassed: true, browserVerified: false, approvalRequired: true });
  return { ...run, lifecycle, browser, approval, proofTimeline: buildLiveProofTimeline(lifecycle.proof), explanation: explainStreamsCodexBuilderRun(lifecycle.proof, approval, browser) };
}

export function markStreamsCodexBrowserVerified(run: StreamsCodexBuilderRunState): StreamsCodexBuilderRunState {
  const browser = resolveBrowserVerification(run.browser, { ok: true });
  let lifecycle = transitionCodexLifecycle(run.lifecycle, "BROWSER_VERIFYING", `Browser verification ran for ${run.goal.route}.`, "info", { route: run.goal.route });
  lifecycle = transitionCodexLifecycle(lifecycle, "BROWSER_VERIFIED", `Browser verification passed for ${run.goal.route}.`, "success", { route: run.goal.route });
  lifecycle = transitionCodexLifecycle(lifecycle, "DIFF_AWAITING_APPROVAL", "Diff, build proof, browser proof, and rollback checkpoint are ready for user approval.", "warning");
  const approval = createDiffApprovalState({ changedFiles: [run.goal.filePath], changedLineCount: run.approval.changedLineCount, buildPassed: true, browserVerified: true, approvalRequired: true });
  return { ...run, lifecycle, browser, approval, proofTimeline: buildLiveProofTimeline(lifecycle.proof), explanation: explainStreamsCodexBuilderRun(lifecycle.proof, approval, browser) };
}

export function approveStreamsCodexRun(run: StreamsCodexBuilderRunState): StreamsCodexBuilderRunState {
  const approval = approveDiff(run.approval);
  const lifecycle = approval.canPush
    ? transitionCodexLifecycle(run.lifecycle, "APPROVED_FOR_PUSH", "User approved diff after proof review. Push may be requested explicitly.", "success")
    : transitionCodexLifecycle(run.lifecycle, "PUSH_BLOCKED", approval.reason, "warning");
  return { ...run, lifecycle, approval, proofTimeline: buildLiveProofTimeline(lifecycle.proof), explanation: explainStreamsCodexBuilderRun(lifecycle.proof, approval, run.browser) };
}

export function validateStreamsCodexBestBuilderReadiness(run: StreamsCodexBuilderRunState) {
  const missing: string[] = [];
  if (!run.goal.repo || !run.goal.branch || !run.goal.filePath) missing.push("source truth is incomplete");
  if (!run.checkpoint.restoreCommand) missing.push("rollback restore command missing");
  if (!run.lifecycle.proof.length) missing.push("proof timeline missing");
  if (!run.browser.enabled) missing.push("browser verification hook disabled");
  if (classifyCodexCommandRisk("git add .").blocked !== true) missing.push("git add dot is not blocked");
  if (classifyCodexCommandRisk("git push origin HEAD:main").requiresApproval !== true) missing.push("git push does not require approval");
  const capabilityGaps = run.capabilities.filter((capability) => !capability.implemented).map((capability) => capability.label);
  missing.push(...capabilityGaps);
  return {
    ready: missing.length === 0,
    missing,
    canPushNow: run.approval.canPush,
    approvalStatus: run.approval.status,
    browserStatus: run.browser.status,
    proofEventCount: run.lifecycle.proof.length,
  };
}

export function explainStreamsCodexBuilderRun(events: CodexProofEvent[], approval: CodexDiffApprovalState, browser: CodexBrowserVerificationState) {
  const last = events.at(-1);
  return [
    `Current state: ${last?.state || "REQUEST_RECEIVED"}.`,
    `Browser verification: ${browser.status}.`,
    `Approval: ${approval.status}.`,
    `Push permission: ${approval.canPush ? "available after explicit user action" : "blocked"}.`,
    approval.reason,
  ];
}

export function createIPhoneBestBuilderPrompt(goal: StreamsCodexBuilderGoal) {
  return `Agent 1, connect to Visual Editing and run a full Codex builder test on repo ${goal.repo} branch ${goal.branch} file ${goal.filePath}. Pull real source truth, queue autonomousRepair true with maxRepairAttempts 3, run build/typecheck proof, repair only if a failure happens, rerun until green or attempts are exhausted, show every proof event in the workstation, preview route ${goal.route}, show the diff and browser proof, do not commit, do not push, and stop at approval required.`;
}
