import { describe, expect, it } from "vitest";
import {
  BEST_BUILDER_REQUIRED_CAPABILITIES,
  approveStreamsCodexRun,
  createIPhoneBestBuilderPrompt,
  createStreamsCodexBuilderGoal,
  createStreamsCodexBuilderRun,
  markStreamsCodexBrowserVerified,
  markStreamsCodexBuildPassed,
  validateStreamsCodexBestBuilderReadiness,
} from "../codex-best-builder-orchestrator";

describe("Streams Codex best builder orchestrator", () => {
  it("covers the 13 required best-builder capabilities", () => {
    expect(BEST_BUILDER_REQUIRED_CAPABILITIES.map((capability) => capability.id)).toEqual(Array.from({ length: 13 }, (_, index) => index + 1));
    expect(BEST_BUILDER_REQUIRED_CAPABILITIES.every((capability) => capability.implemented)).toBe(true);
    expect(BEST_BUILDER_REQUIRED_CAPABILITIES.map((capability) => capability.label)).toEqual([
      "understands selected page/route",
      "finds the real files",
      "edits the code",
      "previews the route",
      "sees what broke",
      "repairs automatically",
      "reruns build/tests/browser checks",
      "shows diff and screenshot",
      "asks for approval",
      "pushes only after approval",
      "can rollback",
      "saves proof",
      "explains exactly what was done",
    ]);
  });

  it("extracts repo, branch, file, route, screenshot, and selected context from a prompt", () => {
    const goal = createStreamsCodexBuilderGoal({
      userPrompt: "Fix this page and make it look like the screenshot in repo hawk7227/streamsailive branch main file src/app/streams-ai/page.tsx route /streams-ai/streams-builder",
    });

    expect(goal.repo).toBe("hawk7227/streamsailive");
    expect(goal.branch).toBe("main");
    expect(goal.filePath).toBe("src/app/streams-ai/page.tsx");
    expect(goal.route).toBe("/streams-ai/streams-builder");
    expect(goal.screenshotAttached).toBe(true);
    expect(goal.selectedElementKnown).toBe(true);
  });

  it("creates source truth, rollback, browser, approval, proof timeline, and explanation", () => {
    const goal = createStreamsCodexBuilderGoal({ userPrompt: "Fix this page and make it look like the screenshot" });
    const run = createStreamsCodexBuilderRun(goal);
    const readiness = validateStreamsCodexBestBuilderReadiness(run);

    expect(readiness.ready).toBe(true);
    expect(readiness.canPushNow).toBe(false);
    expect(run.checkpoint.status).toBe("restore_ready");
    expect(run.checkpoint.restoreCommand).toContain("git checkout");
    expect(run.browser.status).toBe("queued");
    expect(run.approval.status).toBe("awaiting_approval");
    expect(run.proofTimeline.map((event) => event.state)).toContain("ROLLBACK_READY");
    expect(run.explanation.join(" ")).toContain("Push permission: blocked");
  });

  it("keeps push blocked until build and browser proof pass, then approval unlocks push", () => {
    const goal = createStreamsCodexBuilderGoal({ userPrompt: "Fix this page and make it look like the screenshot" });
    const initial = createStreamsCodexBuilderRun(goal);
    expect(initial.approval.canPush).toBe(false);

    const buildPassed = markStreamsCodexBuildPassed(initial);
    expect(buildPassed.approval.canPush).toBe(false);
    expect(buildPassed.browser.status).toBe("queued");

    const browserVerified = markStreamsCodexBrowserVerified(buildPassed);
    expect(browserVerified.browser.status).toBe("passed");
    expect(browserVerified.approval.status).toBe("awaiting_approval");
    expect(browserVerified.approval.canPush).toBe(false);

    const approved = approveStreamsCodexRun(browserVerified);
    expect(approved.approval.canPush).toBe(true);
    expect(approved.lifecycle.state).toBe("APPROVED_FOR_PUSH");
  });

  it("generates the iPhone full builder prompt with route preview and approval stop", () => {
    const goal = createStreamsCodexBuilderGoal({ userPrompt: "Fix this page", route: "/streams-ai/streams-builder" });
    const prompt = createIPhoneBestBuilderPrompt(goal);
    expect(prompt).toContain("connect to Visual Editing");
    expect(prompt).toContain("queue autonomousRepair true with maxRepairAttempts 3");
    expect(prompt).toContain("preview route /streams-ai/streams-builder");
    expect(prompt).toContain("stop at approval required");
  });
});
