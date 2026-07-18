import { describe, expect, it } from "vitest";
import {
  BROWSER_VERIFICATION_DEFAULT_VIEWPORTS,
  BROWSER_VERIFICATION_EVIDENCE_CONTRACT,
  validateBrowserVerificationRequest,
} from "../src/lib/streams-builder/browser-verification";

describe("builder browser verification evidence", () => {
  it("accepts safe preview URLs and desktop/mobile viewports", () => {
    expect(validateBrowserVerificationRequest({
      projectId: "project-1",
      sessionId: "session-1",
      targetUrl: "https://example-preview.vercel.app/streams-ai/streams-builder",
      actions: [{ type: "wait_for_selector", selector: "body" }],
      viewports: BROWSER_VERIFICATION_DEFAULT_VIEWPORTS,
    })).toEqual([]);

    expect(BROWSER_VERIFICATION_DEFAULT_VIEWPORTS).toEqual([
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 430, height: 932 },
    ]);
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

  it("locks one shared handler, both routes, mounted workspace, and durable evidence persistence", () => {
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.sharedHandler).toBe(
      "src/lib/streams-builder/browser-verification-route-handler.ts",
    );
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.routes).toEqual([
      "src/app/api/streams-builder/browser-verification/route.ts",
      "src/app/api/v1/builder/verifications/route.ts",
    ]);
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.mountedWorkspace).toBe("Browser Verification");
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.mountedComponent).toBe(
      "src/components/streams-builder/BrowserVerificationPanel.tsx",
    );
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.persistence.assetsRepository).toBe(
      "StreamsAIAssetsRepository",
    );
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.persistence.jobsRepository).toBe(
      "StreamsAIJobsRepository",
    );
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.persistence.evidenceType).toBe(
      "browser_verification_screenshot",
    );
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.evidence).toContain("desktop screenshot");
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.evidence).toContain("mobile screenshot");
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.evidence).toContain("checkpoint identity");
    expect(BROWSER_VERIFICATION_EVIDENCE_CONTRACT.evidence).toContain("preview identity");
  });
});
