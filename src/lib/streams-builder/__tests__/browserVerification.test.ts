import { describe, expect, it } from "vitest";
import { validateBrowserVerificationRequest } from "../browser-verification";

describe("browser verification validation", () => {
  it("accepts a safe preview request", () => {
    const errors = validateBrowserVerificationRequest({
      projectId: "project-123",
      sessionId: "session-123",
      targetUrl: "https://streamsailive.vercel.app/streams-ai/streams-builder",
      actions: [{ type: "wait_for_selector", selector: "body" }],
    });

    expect(errors).toHaveLength(0);
  });

  it("requires a safe target url", () => {
    const errors = validateBrowserVerificationRequest({
      projectId: "project-123",
      sessionId: "session-123",
      targetUrl: "not-a-url",
      actions: [{ type: "wait_for_selector", selector: "body" }],
    });

    expect(errors).toContain("targetUrl must be a safe http(s) preview URL.");
  });

  it("requires at least one action", () => {
    const errors = validateBrowserVerificationRequest({
      projectId: "project-123",
      sessionId: "session-123",
      targetUrl: "https://streamsailive.vercel.app/streams-ai/streams-builder",
      actions: [],
    });

    expect(errors).toContain("actions are required.");
  });
});
