import { describe, expect, it } from "vitest";
import {
  approveDiff,
  buildLiveProofTimeline,
  classifyCodexCommandRisk,
  createBrowserVerificationHook,
  createCodexRepairLifecycle,
  createDiffApprovalState,
  createNonConsolidatedCodexReliabilityPlan,
  createRollbackCheckpoint,
  markRollbackReady,
  resolveBrowserVerification,
  transitionCodexLifecycle,
} from "../codex-builder-reliability";

describe("Codex builder reliability layer", () => {
  it("classifies safe, sandboxed, approval-required, and blocked commands", () => {
    expect(classifyCodexCommandRisk("git diff").risk).toBe("safe");
    expect(classifyCodexCommandRisk("pnpm build").risk).toBe("sandboxed");
    expect(classifyCodexCommandRisk("git push origin HEAD:main").risk).toBe("approval_required");
    expect(classifyCodexCommandRisk("git add .").risk).toBe("blocked");
  });

  it("tracks repair job lifecycle states and live proof timeline", () => {
    let lifecycle = createCodexRepairLifecycle();
    lifecycle = transitionCodexLifecycle(lifecycle, "SOURCE_TRUTH_READY", "Source truth pulled.", "success");
    lifecycle = transitionCodexLifecycle(lifecycle, "BUILD_FAILED", "Build failed and logs captured.", "error");
    lifecycle = transitionCodexLifecycle(lifecycle, "REPAIR_PATCH_GENERATED", "Repair patch generated.", "info");
    lifecycle = transitionCodexLifecycle(lifecycle, "BUILD_PASSED", "Rerun passed.", "success");

    const timeline = buildLiveProofTimeline(lifecycle.proof);
    expect(lifecycle.state).toBe("BUILD_PASSED");
    expect(timeline.map((event) => event.state)).toContain("REPAIR_PATCH_GENERATED");
    expect(timeline.at(-1)?.message).toBe("Rerun passed.");
  });

  it("creates browser verification hook and resolves pass/fail state", () => {
    const hook = createBrowserVerificationHook({ route: "streams-ai/streams-builder" });
    expect(hook.route).toBe("/streams-ai/streams-builder");
    expect(hook.requiredBeforeApproval).toBe(true);
    expect(resolveBrowserVerification(hook, { ok: true }).status).toBe("passed");
    expect(resolveBrowserVerification(hook, { ok: false, error: "route failed" }).lastError).toBe("route failed");
  });

  it("locks diff approval until build and browser proof pass", () => {
    const blocked = createDiffApprovalState({ changedFiles: ["src/app/page.tsx"], changedLineCount: 12, buildPassed: true, browserVerified: false });
    expect(blocked.canPush).toBe(false);
    expect(approveDiff(blocked).status).toBe("rejected");

    const ready = createDiffApprovalState({ changedFiles: ["src/app/page.tsx"], changedLineCount: 12, buildPassed: true, browserVerified: true });
    expect(ready.status).toBe("awaiting_approval");
    expect(approveDiff(ready).canPush).toBe(true);
  });

  it("creates rollback checkpoint state", () => {
    const checkpoint = createRollbackCheckpoint({ repo: "hawk7227/streamsailive", branch: "main", files: ["src/app/page.tsx"], checkpointId: "checkpoint-test" });
    expect(checkpoint.status).toBe("created");
    expect(checkpoint.restoreCommand).toContain("git checkout main -- src/app/page.tsx");
    expect(markRollbackReady(checkpoint).status).toBe("restore_ready");
  });

  it("builds the non-consolidated reliability plan with the required test prompt", () => {
    const plan = createNonConsolidatedCodexReliabilityPlan({ repo: "hawk7227/streamsailive", branch: "main", filePath: "src/app/streams-ai/page.tsx", route: "/streams-ai" });
    expect(plan.commandPolicy.build.allowedAutomatically).toBe(true);
    expect(plan.commandPolicy.push.requiresApproval).toBe(true);
    expect(plan.commandPolicy.forbiddenAddDot.blocked).toBe(true);
    expect(plan.userTestPrompt).toContain("queue autonomousRepair true with maxRepairAttempts 3");
    expect(plan.userTestPrompt).toContain("do not commit, do not push, and stop at approval required");
  });
});
