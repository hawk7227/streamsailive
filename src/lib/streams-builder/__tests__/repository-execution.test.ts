import { describe, expect, it } from "vitest";
import { createRepositoryExecutionPlan } from "../repository-execution";

describe("Streams Builder repository execution planning", () => {
  it("creates an unproven plan for the full approved git/build command chain", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      branchName: "streams-builder/project-123",
      requestedCommands: [
        "clone_repo",
        "read_full_file",
        "apply_unified_diff",
        "npm_run_build",
        "git_status",
        "git_diff",
        "git_add_specific_file",
        "git_commit",
        "git_push",
      ],
      targetFiles: ["src/app/streams-ai/streams-builder/page.tsx"],
      unifiedDiff: "diff --git a/file.ts b/file.ts",
      commitMessage: "Add builder execution slice",
    });

    expect(plan.truthState).toBe("UNPROVEN");
    expect(plan.blockedReasons).toHaveLength(0);
    expect(plan.steps.map((step) => step.command)).toEqual([
      "clone_repo",
      "read_full_file",
      "apply_unified_diff",
      "npm_run_build",
      "git_status",
      "git_diff",
      "git_add_specific_file",
      "git_commit",
      "git_push",
    ]);
  });

  it("blocks unsafe repository names", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "not-a-repo",
      requestedCommands: ["clone_repo"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("repoFullName must be owner/name.");
  });

  it("requires clone before repository commands", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["git_status"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("clone_repo is required before repository commands.");
  });

  it("blocks unsafe target file paths", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["clone_repo", "read_full_file"],
      targetFiles: ["../outside.txt"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("Unsafe file path: ../outside.txt");
  });

  it("requires target files before reading full files", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["clone_repo", "read_full_file"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("targetFiles is required before read_full_file.");
  });

  it("requires target files before staging specific files", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["clone_repo", "git_add_specific_file"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("targetFiles is required before git_add_specific_file.");
  });

  it("requires a unified diff before applying a patch", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["clone_repo", "apply_unified_diff"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("unifiedDiff is required before apply_unified_diff.");
  });

  it("requires a commit message before commit", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["clone_repo", "git_commit"],
    });

    expect(plan.truthState).toBe("FAILED");
    expect(plan.blockedReasons).toContain("commitMessage is required before git_commit.");
  });

  it("marks staging as approval-gated and specific-file only", () => {
    const plan = createRepositoryExecutionPlan({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      requestedCommands: ["clone_repo", "git_add_specific_file"],
      targetFiles: ["src/lib/streams-builder/repository-execution.ts"],
    });

    expect(plan.blockedReasons).toHaveLength(0);
    expect(plan.steps[1].command).toBe("git_add_specific_file");
    expect(plan.steps[1].requiresApproval).toBe(true);
    expect(plan.steps[1].description).toContain("Never use git add dot");
  });
});
