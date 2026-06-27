import { describe, expect, it } from "vitest";
import {
  classifyCodexFailure,
  createCodexRepairPolicy,
  runCodexRepairLoop,
  validateCodexRepairPolicy,
} from "../codex-repair-loop";
import { createRepositoryExecutionPlan } from "../repository-execution";

describe("Codex repair loop core", () => {
  it("classifies common build failures", () => {
    expect(classifyCodexFailure("", "Cannot find module '@/missing'")).toBe("module-resolution");
    expect(classifyCodexFailure("", "Type error: Property foo does not exist")).toBe("typescript");
    expect(classifyCodexFailure("", "AssertionError: expected true")).toBe("test");
  });

  it("blocks auto repair for approval-gated git write commands", () => {
    const policy = createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 3 });
    const blocked = validateCodexRepairPolicy(policy, "git_push", ["src/app/page.tsx"]);
    expect(blocked.join(" ")).toContain("Approval-gated git write command");
  });

  it("generates patch, applies patch, reruns build, and reports repaired", async () => {
    const events: string[] = [];
    const result = await runCodexRepairLoop({
      failedCommand: "npm_run_build",
      stdout: "",
      stderr: "Type error: Property title does not exist",
      targetFiles: ["src/app/page.tsx"],
      policy: createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 3 }),
      generatePatch: async ({ attempt }) => attempt === 1 ? "diff --git a/src/app/page.tsx b/src/app/page.tsx\n--- a/src/app/page.tsx\n+++ b/src/app/page.tsx\n@@ -1 +1 @@\n-old\n+new\n" : null,
      applyPatch: async () => ({ ok: true, stdout: "patch applied", stderr: "" }),
      rerunCommand: async () => ({ ok: true, stdout: "build passed", stderr: "" }),
      emit: async (event) => { events.push(event.status); },
    });

    expect(result.repaired).toBe(true);
    expect(result.blocked).toBe(false);
    expect(events).toEqual(["patch_generated", "patch_applied", "rerun_passed"]);
    expect(result.proof).toContain("repair attempt 1 rerun passed");
    expect(result.unproven).toContain("push remains locked until user approval");
  });

  it("retries until max attempts and returns failed when reruns keep failing", async () => {
    const result = await runCodexRepairLoop({
      failedCommand: "npm_run_build",
      stdout: "",
      stderr: "Build failed",
      targetFiles: ["src/app/page.tsx"],
      policy: createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 2 }),
      generatePatch: async ({ attempt }) => `diff --git a/src/app/page.tsx b/src/app/page.tsx\n--- a/src/app/page.tsx\n+++ b/src/app/page.tsx\n@@ -1 +1 @@\n-old${attempt}\n+new${attempt}\n`,
      applyPatch: async () => ({ ok: true }),
      rerunCommand: async () => ({ ok: false, stderr: "still failing" }),
    });

    expect(result.repaired).toBe(false);
    expect(result.finalError).toContain("exhausted 2 attempts");
    expect(result.attempts.filter((attempt) => attempt.status === "rerun_failed")).toHaveLength(2);
  });
});

describe("repository execution Codex repair plan", () => {
  it("carries autonomous repair policy through the plan", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      branchName: "streams-builder/project-123",
      requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"],
      targetFiles: ["src/app/page.tsx"],
      autonomousRepair: true,
      maxRepairAttempts: 5,
      maxFilesTouched: 2,
      runBuildAfterPatch: true,
      requireApprovalBeforePush: true,
    });

    expect(plan.blockedReasons).toHaveLength(0);
    expect(plan.codexRepair).toEqual({
      autonomousRepair: true,
      maxRepairAttempts: 5,
      maxFilesTouched: 2,
      runBuildAfterPatch: true,
      requireApprovalBeforePush: true,
    });
  });
});
