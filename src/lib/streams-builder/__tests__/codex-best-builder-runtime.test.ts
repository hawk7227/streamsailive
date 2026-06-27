import { describe, expect, it } from "vitest";
import { createBestBuilderRuntimeMetadata, classifyRepositoryCommandPolicy } from "../codex-best-builder-runtime";

describe("Streams Codex best builder runtime metadata", () => {
  it("classifies repository commands for automatic or approval-gated execution", () => {
    expect(classifyRepositoryCommandPolicy("read_full_file").allowedAutomatically).toBe(true);
    expect(classifyRepositoryCommandPolicy("npm_run_build").risk).toBe("sandboxed");
    expect(classifyRepositoryCommandPolicy("git_commit").requiresApproval).toBe(true);
  });

  it("creates runtime metadata for the full iPhone to Codex builder path", () => {
    const metadata = createBestBuilderRuntimeMetadata({
      userPrompt: "Fix this page and make it look like the screenshot",
      repoFullName: "hawk7227/streamsailive",
      branchName: "main",
      route: "/streams-ai/streams-builder",
      targetFiles: ["src/app/streams-ai/page.tsx"],
      requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"],
      autonomousRepair: true,
      maxRepairAttempts: 3,
      requireApprovalBeforePush: true,
    });

    expect(metadata.enabled).toBe(true);
    expect(metadata.goal.repo).toBe("hawk7227/streamsailive");
    expect(metadata.goal.route).toBe("/streams-ai/streams-builder");
    expect(metadata.readiness.ready).toBe(true);
    expect(metadata.diffApproval.canPush).toBe(false);
    expect(metadata.requiredCapabilities).toHaveLength(13);
    expect(metadata.proofTimeline.map((event) => event.state)).toContain("ROLLBACK_READY");
    expect(metadata.iPhonePrompt).toContain("preview route /streams-ai/streams-builder");
    expect(metadata.iPhonePrompt).toContain("stop at approval required");
  });
});
