import { describe, expect, it } from "vitest";
import { createSandboxCommandBatch } from "../sandbox-commands";

describe("Streams Builder sandbox command batches", () => {
  it("creates deterministic commands for clone, build, status, diff, add, commit, and push", () => {
    const batch = createSandboxCommandBatch({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      branchName: "streams-builder/project-123",
      commands: [
        "clone_repo",
        "npm_run_build",
        "git_status",
        "git_diff",
        "git_add_specific_file",
        "git_commit",
        "git_push",
      ],
      targetFiles: ["src/app/streams-ai/streams-builder/page.tsx"],
      commitMessage: "Add builder route",
    });

    expect(batch.projectId).toBe("project-123");
    expect(batch.commands.map((command) => command.command)).toEqual([
      "clone_repo",
      "npm_run_build",
      "git_status",
      "git_diff",
      "git_add_specific_file",
      "git_commit",
      "git_push",
    ]);
    expect(batch.commands[0].args).toEqual([
      "git",
      "clone",
      "https://github.com/hawk7227/streamsailive.git",
      "/tmp/streams-builder/project-123",
    ]);
  });

  it("stages only explicit target files", () => {
    const batch = createSandboxCommandBatch({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      branchName: "streams-builder/project-123",
      commands: ["git_add_specific_file"],
      targetFiles: ["src/lib/streams-builder/repository-execution.ts"],
    });

    expect(batch.commands[0].args).toEqual([
      "git",
      "add",
      "src/lib/streams-builder/repository-execution.ts",
    ]);
    expect(batch.commands[0].args).not.toContain(".");
    expect(batch.commands[0].requiresApproval).toBe(true);
  });

  it("marks commit and push as approval gated", () => {
    const batch = createSandboxCommandBatch({
      projectId: "project-123",
      sessionId: "session-123",
      repoFullName: "hawk7227/streamsailive",
      branchName: "streams-builder/project-123",
      commands: ["git_commit", "git_push"],
      commitMessage: "Safe commit",
    });

    expect(batch.commands.every((command) => command.requiresApproval)).toBe(true);
    expect(batch.commands[0].args).toEqual(["git", "commit", "-m", "Safe commit"]);
    expect(batch.commands[1].args).toEqual(["git", "push", "origin", "HEAD:streams-builder/project-123"]);
  });
});
