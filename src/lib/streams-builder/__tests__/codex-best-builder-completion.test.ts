import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
function readRepoFile(relativePath: string) { return fs.readFileSync(path.join(repoRoot, relativePath), "utf8"); }

describe("Streams Codex best builder completion surfaces", () => {
  it("routes repository worker through best-builder lifecycle wrapper", () => {
    const route = readRepoFile("src/app/api/streams-builder/repository-execution/worker/route.ts");
    expect(route).toContain("processBestRepositoryExecutionJob");
    expect(route).toContain("streams-builder-best-repository-worker");
    expect(route).toContain("best-builder job processor invoked");
  });

  it("best worker wrapper emits lifecycle timeline, rollback, browser, and approval metadata", () => {
    const worker = readRepoFile("src/lib/streams-builder/repository-worker-best.ts");
    expect(worker).toContain("repository.best.lifecycle");
    expect(worker).toContain("REQUEST_RECEIVED");
    expect(worker).toContain("SOURCE_TRUTH_READY");
    expect(worker).toContain("SANDBOX_READY");
    expect(worker).toContain("ROLLBACK_READY");
    expect(worker).toContain("BUILD_PASSED");
    expect(worker).toContain("BROWSER_VERIFYING");
    expect(worker).toContain("DIFF_AWAITING_APPROVAL");
    expect(worker).toContain("PUSH_BLOCKED");
    expect(worker).toContain("bestBuilderReliability");
  });

  it("browser verification captures a real screenshot artifact when Playwright runs", () => {
    const browser = readRepoFile("src/lib/streams-builder/browser-verification.ts");
    expect(browser).toContain("BrowserScreenshotArtifact");
    expect(browser).toContain("page.screenshot");
    expect(browser).toContain("data:image/png;base64");
    expect(browser).toContain("captured screenshot artifact");
  });

  it("diff approval and rollback gate is visible in workstation modules", () => {
    const panel = readRepoFile("src/components/streams-builder/workspace-modules/CodexDiffApprovalPanel.tsx");
    const modulePanel = readRepoFile("src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx");
    expect(panel).toContain("Codex Approval Gate");
    expect(panel).toContain("Browser Screenshot");
    expect(panel).toContain("Rollback");
    expect(panel).toContain("Push blocked until approval");
    expect(modulePanel).toContain("CodexDiffApprovalPanel");
    expect(modulePanel).toContain("shouldShowApprovalGate");
  });
});
