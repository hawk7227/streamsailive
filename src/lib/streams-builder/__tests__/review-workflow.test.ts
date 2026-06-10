import { describe, expect, it } from "vitest";
import { evaluateReviewWorkflow } from "../review-workflow";

describe("Streams Builder live review workflow", () => {
  const base = {
    projectId: "project-123",
    sessionId: "session-123",
    previewUrl: "https://streamsailive.vercel.app/streams-ai/streams-builder",
    route: "/streams-ai/streams-builder",
    component: "StreamsBuilderControlPanel",
    file: "src/components/streams-builder/StreamsBuilderControlPanel.tsx",
    githubPath: "src/components/streams-builder/StreamsBuilderControlPanel.tsx",
  };

  it("blocks approval when proof gates are unproven", () => {
    const result = evaluateReviewWorkflow({
      ...base,
      buildStatus: "PROVEN",
      proofStatus: "UNPROVEN",
      browserVerificationStatus: "PROVEN",
      workflowVerificationStatus: "UNPROVEN",
      decision: "approve",
    });

    expect(result.ok).toBe(false);
    expect(result.reviewState).toBe("blocked");
    expect(result.blockedReasons).toContain("Proof must be PROVEN before live review approval.");
    expect(result.blockedReasons).toContain("Workflow verification must be PROVEN before live review approval.");
  });

  it("approves only when all required gates are proven", () => {
    const result = evaluateReviewWorkflow({
      ...base,
      buildStatus: "PROVEN",
      proofStatus: "PROVEN",
      browserVerificationStatus: "PROVEN",
      workflowVerificationStatus: "PROVEN",
      decision: "approve",
    });

    expect(result.ok).toBe(true);
    expect(result.truthState).toBe("PROVEN");
    expect(result.reviewState).toBe("approved");
    expect(result.proof).toContain("User approved the live frontend.");
  });

  it("requires comments when requesting changes", () => {
    const result = evaluateReviewWorkflow({
      ...base,
      buildStatus: "PROVEN",
      proofStatus: "PROVEN",
      browserVerificationStatus: "PROVEN",
      workflowVerificationStatus: "PROVEN",
      decision: "request_changes",
    });

    expect(result.ok).toBe(false);
    expect(result.reviewState).toBe("blocked");
    expect(result.blockedReasons).toContain("comment is required for this review decision.");
  });

  it("records requested changes when a comment is present", () => {
    const result = evaluateReviewWorkflow({
      ...base,
      buildStatus: "PROVEN",
      proofStatus: "PROVEN",
      browserVerificationStatus: "PROVEN",
      workflowVerificationStatus: "PROVEN",
      decision: "request_changes",
      comment: "Fix spacing on mobile.",
    });

    expect(result.ok).toBe(true);
    expect(result.truthState).toBe("WAITING_FOR_USER");
    expect(result.reviewState).toBe("changes_requested");
  });
});
