import { describe, expect, it } from "vitest";
import {
  classifyCodexFailure,
  createCodexRepairPolicy,
  runCodexRepairLoop,
  validateCodexRepairPolicy,
  validateUnifiedDiffPatch,
} from "../codex-repair-loop";
import { createRepositoryExecutionPlan } from "../repository-execution";

function repairDiff(before = "old", after = "new", path = "src/app/page.tsx") {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    `-${before}`,
    `+${after}`,
    "",
  ].join("\n");
}

describe("Codex repair loop core", () => {
  it("classifies common build and infrastructure failures", () => {
    expect(classifyCodexFailure("", "Cannot find module '@/missing'")).toBe("module-resolution");
    expect(classifyCodexFailure("", "Type error: Property foo does not exist")).toBe("typescript");
    expect(classifyCodexFailure("", "AssertionError: expected true")).toBe("test");
    expect(classifyCodexFailure("", "permission denied for table previews")).toBe("database");
  });

  it("blocks auto repair for approval-gated git write commands", () => {
    const policy = createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 3 });
    const blocked = validateCodexRepairPolicy(policy, "git_push", ["src/app/page.tsx"]);
    expect(blocked.join(" ")).toContain("Approval-gated git write command");
  });

  it("rejects path traversal, generated files, and ungrounded patch targets", () => {
    const policy = createCodexRepairPolicy({ autonomousRepair: true, maxFilesTouched: 2 });
    expect(validateUnifiedDiffPatch(repairDiff("a", "b", "../secret.ts"), policy, ["src/app/page.tsx"]).valid).toBe(false);
    expect(validateUnifiedDiffPatch(repairDiff("a", "b", "node_modules/pkg/index.js"), policy, ["src/app/page.tsx"]).valid).toBe(false);
    expect(validateUnifiedDiffPatch(repairDiff("a", "b", "src/app/other.tsx"), policy, ["src/app/page.tsx"]).errors.join(" ")).toContain("outside the grounded repair scope");
  });

  it("generates patch, applies patch, reruns build, and reports repaired", async () => {
    const events: string[] = [];
    const result = await runCodexRepairLoop({
      failedCommand: "npm_run_build",
      stdout: "",
      stderr: "Type error: Property title does not exist",
      targetFiles: ["src/app/page.tsx"],
      policy: createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 3 }),
      generatePatch: async ({ attempt }) => attempt === 1 ? repairDiff("old", "new") : null,
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

  it("feeds the latest rerun failure into the next reasoning attempt", async () => {
    const evidence: string[] = [];
    const result = await runCodexRepairLoop({
      failedCommand: "npm_run_build",
      stderr: "first failure",
      targetFiles: ["src/app/page.tsx"],
      policy: createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 2 }),
      contextProvider: ({ stderr }) => { evidence.push(stderr); return "FILE: src/app/page.tsx\nold"; },
      generatePatch: async ({ attempt }) => repairDiff(`old${attempt}`, `new${attempt}`),
      applyPatch: async () => ({ ok: true }),
      rerunCommand: async ({ } as never) => ({ ok: false, stderr: evidence.length === 1 ? "second causal failure" : "third failure" }),
    });

    expect(result.repaired).toBe(false);
    expect(evidence[0]).toContain("first failure");
    expect(evidence[1]).toContain("second causal failure");
  });

  it("stops repeated identical patches as no progress", async () => {
    const result = await runCodexRepairLoop({
      failedCommand: "npm_run_build",
      stderr: "Build failed",
      targetFiles: ["src/app/page.tsx"],
      policy: createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 3 }),
      generatePatch: async () => repairDiff("old", "new"),
      applyPatch: async () => ({ ok: true }),
      rerunCommand: async () => ({ ok: false, stderr: "still failing" }),
    });
    expect(result.attempts.some((attempt) => attempt.status === "no_progress")).toBe(true);
  });

  it("retries until max attempts and returns failed when distinct reruns keep failing", async () => {
    const result = await runCodexRepairLoop({
      failedCommand: "npm_run_build",
      stdout: "",
      stderr: "Build failed",
      targetFiles: ["src/app/page.tsx"],
      policy: createCodexRepairPolicy({ autonomousRepair: true, maxAttempts: 2 }),
      generatePatch: async ({ attempt }) => repairDiff(`old${attempt}`, `new${attempt}`),
      applyPatch: async () => ({ ok: true }),
      rerunCommand: async () => ({ ok: false, stderr: "still failing" }),
    });

    expect(result.repaired).toBe(false);
    expect(result.finalError).toContain("exhausted");
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
    expect(plan.codexRepair).toEqual({ autonomousRepair: true, maxRepairAttempts: 5, maxFilesTouched: 2, runBuildAfterPatch: true, requireApprovalBeforePush: true });
  });
});
