import { describe, expect, it } from "vitest";
import {
  createAgentOneWorkspaceState,
  getAgentOneRepairPlan,
  rebuildAgentOneWorkspaceState,
  verifyAgentOneWorkspaceState,
} from "./agent-one-state-controller";

describe("Agent 1 source-backed state controller", () => {
  it("blocks push when a source file has not been pulled and SHA is missing", () => {
    const state = createAgentOneWorkspaceState({
      selectedRepo: "hawk7227/streamsailive",
      selectedBranch: "main",
      selectedFile: "src/app/about/page.tsx",
      selectedRoute: "/about",
    });

    const result = verifyAgentOneWorkspaceState(state);

    expect(result.canPush).toBe(false);
    expect(result.status).toBe("Blocked");
    expect(result.checks.map((check) => check.code)).toContain("missing-sha");
    expect(getAgentOneRepairPlan(state)).toContain("re-pull-file");
  });

  it("verifies when selected file, opened file, active file, write target, route, preview, and SHA all match", () => {
    const base = createAgentOneWorkspaceState({
      selectedRepo: "hawk7227/streamsailive",
      selectedBranch: "main",
      selectedFile: "src/app/about/page.tsx",
      selectedRoute: "/about",
    });
    const state = rebuildAgentOneWorkspaceState(base, {
      activeWorkFile: "src/app/about/page.tsx",
      openedFile: "src/app/about/page.tsx",
      writeTarget: "src/app/about/page.tsx",
      activeRoute: "/about",
      activePreview: "/about",
      sha: "abc123",
      content: "export default function Page() { return <main />; }",
      previewLoaded: true,
      buildOk: true,
    });

    const result = verifyAgentOneWorkspaceState(state);

    expect(result.canPush).toBe(true);
    expect(result.status).toBe("Verified");
    expect(result.checks).toHaveLength(0);
  });

  it("blocks wrong-file pushes and returns block-push in the repair plan", () => {
    const state = {
      selectedRepo: "hawk7227/streamsailive",
      selectedBranch: "main",
      selectedFile: "src/app/about/page.tsx",
      selectedRoute: "/about",
      activeWorkFile: "src/app/streams-builder/page.tsx",
      openedFile: "src/app/streams-builder/page.tsx",
      writeTarget: "src/app/streams-builder/page.tsx",
      componentFile: "src/app/streams-builder/page.tsx",
      activeRoute: "/streams-builder",
      activePreview: "/streams-builder",
      activeCode: "export default function Page() { return <main />; }",
      activeProof: "Preview opened",
      activeSha: "abc123",
      lastPulledSha: "abc123",
      previewLoaded: true,
      previewHardCoded: false,
      buildOk: true,
    };

    const result = verifyAgentOneWorkspaceState(state);
    const plan = getAgentOneRepairPlan(state);

    expect(result.canPush).toBe(false);
    expect(result.checks.map((check) => check.code)).toEqual(expect.arrayContaining(["wrong-file-open", "component-mismatch", "write-target-mismatch", "route-mismatch"]));
    expect(plan).toContain("block-push");
  });

  it("blocks hard-coded preview proof", () => {
    const base = createAgentOneWorkspaceState({
      selectedRepo: "hawk7227/streamsailive",
      selectedBranch: "main",
      selectedFile: "src/app/about/page.tsx",
      selectedRoute: "/about",
    });
    const state = {
      ...rebuildAgentOneWorkspaceState(base, {
        activeWorkFile: "src/app/about/page.tsx",
        openedFile: "src/app/about/page.tsx",
        writeTarget: "src/app/about/page.tsx",
        activeRoute: "/about",
        activePreview: "/about",
        sha: "abc123",
        content: "export default function Page() { return <main />; }",
        previewLoaded: true,
        buildOk: true,
      }),
      previewHardCoded: true,
    };

    const result = verifyAgentOneWorkspaceState(state);

    expect(result.canPush).toBe(false);
    expect(result.checks.map((check) => check.code)).toContain("wrong-route-preview");
  });
});
