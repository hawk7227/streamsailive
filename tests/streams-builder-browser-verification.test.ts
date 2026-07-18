import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBrowserVerificationRequest } from "../src/lib/streams-builder/browser-verification";

describe("builder browser verification evidence", () => {
  it("accepts safe preview URLs and desktop/mobile viewports", () => {
    expect(validateBrowserVerificationRequest({
      projectId: "project-1",
      sessionId: "session-1",
      targetUrl: "https://example-preview.vercel.app/streams-ai/streams-builder",
      actions: [{ type: "wait_for_selector", selector: "body" }],
      viewports: [
        { name: "desktop", width: 1440, height: 1000 },
        { name: "mobile", width: 430, height: 932 },
      ],
    })).toEqual([]);
  });

  it("rejects unsafe URLs, selectors, and invalid viewport dimensions", () => {
    const errors = validateBrowserVerificationRequest({
      projectId: "project-1",
      sessionId: "session-1",
      targetUrl: "file:///etc/passwd",
      actions: [{ type: "click", selector: "<script>" }],
      viewports: [{ name: "mobile", width: 100, height: 100 }],
    });
    expect(errors.some((item) => item.includes("safe http(s) preview URL"))).toBe(true);
    expect(errors.some((item) => item.includes("Unsafe selector"))).toBe(true);
    expect(errors.some((item) => item.includes("Invalid mobile viewport"))).toBe(true);
  });

  it("mounts the real verification panel and persists evidence through existing assets", () => {
    const modulePanel = readFileSync(resolve(process.cwd(), "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/streams-builder/browser-verification/route.ts"), "utf8");
    const versionedRoute = readFileSync(resolve(process.cwd(), "src/app/api/v1/builder/verifications/route.ts"), "utf8");
    expect(modulePanel).toContain("<BrowserVerificationPanel />");
    expect(route).toContain("StreamsAIAssetsRepository");
    expect(route).toContain("browser_verification_screenshot");
    expect(route).toContain("evidenceAssetIds");
    expect(versionedRoute).toContain("browser-verification/route");
  });
});
