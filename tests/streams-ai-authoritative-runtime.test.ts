// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { classifyStreamsIntent, detectLiteralRequestedHeadings } from "../src/lib/streams-ai/runtime/intent-engine";
import { routeStreamsModels } from "../src/lib/streams-ai/runtime/model-router";
import { judgeStreamsResponse } from "../src/lib/streams-ai/quality/semantic-judge";
import { executeAuthoritativeStreamsTurn, prepareAuthoritativeStreamsTurn } from "../src/lib/streams-ai/runtime/authoritative-turn-controller";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const scope = {
  tenantId: "tenant-1",
  userId: "user-1",
  defaultProjectId: "project-default",
  workspaceId: "streams-ai" as const,
  moduleId: "streams-ai-core" as const,
  productId: "streams-ai" as const,
};

describe("Streams authoritative runtime", () => {
  it("classifies exhaustive image analysis with exact structure", () => {
    const intent = classifyStreamsIntent({
      userMessage: "Review the screenshot in a full non-compressed answer using exactly these headings and a table.",
      hasImages: true,
    });
    expect(intent.primaryIntent).toBe("image_analysis");
    expect(intent.requestedDepth).toBe("exhaustive");
    expect(intent.requestedFormat.exact).toBe(true);
    expect(intent.requestedFormat.table).toBe(true);
    expect(intent.needsImages).toBe(true);
  });

  it("preserves literal numbered section headings after natural marker wording", () => {
    const instruction = [
      "Give me a short answer.",
      "Use exactly these section headings:",
      "1. Visible Benefit",
      "2. Operational Benefit",
      "3. Risk to Watch",
      "Keep it concise.",
    ].join("\n");
    expect(detectLiteralRequestedHeadings(instruction)).toEqual([
      "1. Visible Benefit",
      "2. Operational Benefit",
      "3. Risk to Watch",
    ]);
    const intent = classifyStreamsIntent({ userMessage: instruction });
    expect(intent.requestedFormat.exact).toBe(true);
    expect(intent.requestedFormat.numberedSections).toBe(true);
    expect(intent.requestedFormat.requestedOrder).toBe(true);
    expect(intent.requestedFormat.headings).toEqual([
      "1. Visible Benefit",
      "2. Operational Benefit",
      "3. Risk to Watch",
    ]);
  });

  it("classifies connected actions before repository actions", () => {
    expect(classifyStreamsIntent({ userMessage: "Send this email to the customer." }).primaryIntent).toBe("connected_action");
    expect(classifyStreamsIntent({ userMessage: "Delete the calendar event." }).primaryIntent).toBe("connected_action");
    expect(classifyStreamsIntent({ userMessage: "Commit and push the repository changes." }).primaryIntent).toBe("repository_action");
  });

  it("routes complex research to a verified capable tool model", () => {
    const intent = classifyStreamsIntent({ userMessage: "Research the latest current API changes and compare the official sources in detail." });
    const route = routeStreamsModels({ intent, hasImages: false, contextTokens: 12500 });
    expect(route.primary.supportsTools).toBe(true);
    expect(route.primary.researchTier).toBeGreaterThanOrEqual(3);
    expect(route.primary.capabilitySource).not.toBe("conservative-fallback");
    expect(route.judge.role).toBe("judge");
    expect(route.repair.role).toBe("repair");
  });

  it("rejects unsupported completion claims", () => {
    const intent = classifyStreamsIntent({ userMessage: "Deploy the app to production." });
    const result = judgeStreamsResponse({
      userInstruction: "Deploy the app to production.",
      responseText: "Done. I deployed the app and it is now live.",
      intent,
      toolEvidenceCount: 0,
    });
    expect(result.accepted).toBe(false);
    expect(result.criticalDefect).toBe(true);
    expect(result.defects.some((defect) => defect.code === "UNSUPPORTED_ACTION_CLAIM")).toBe(true);
  });

  it("makes removed literal heading numbering a critical rejection", () => {
    const instruction = [
      "Use exactly these section headings:",
      "1. Visible Benefit",
      "2. Operational Benefit",
      "3. Risk to Watch",
    ].join("\n");
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const result = judgeStreamsResponse({
      userInstruction: intent.requestedOutcome,
      responseText: "## Visible Benefit\nUseful.\n\n## Operational Benefit\nFaster.\n\n## Risk to Watch\nErrors.",
      intent,
    });
    expect(result.accepted).toBe(false);
    expect(result.criticalDefect).toBe(true);
    expect(result.defects.filter((defect) => defect.code === "MISSING_LITERAL_HEADING")).toHaveLength(3);
  });

  it("rejects exact literal headings in the wrong order", () => {
    const instruction = [
      "Use exactly these headings in this order:",
      "1. First",
      "2. Second",
      "3. Third",
    ].join("\n");
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const result = judgeStreamsResponse({
      userInstruction: instruction,
      responseText: "2. Second\nB\n\n1. First\nA\n\n3. Third\nC",
      intent,
    });
    expect(result.accepted).toBe(false);
    expect(result.defects.some((defect) => defect.code === "WRONG_LITERAL_HEADING_ORDER")).toBe(true);
  });

  it("accepts exact literal numbered headings in the requested order", () => {
    const instruction = [
      "Use exactly these section headings:",
      "1. Visible Benefit",
      "2. Operational Benefit",
      "3. Risk to Watch",
    ].join("\n");
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const result = judgeStreamsResponse({
      userInstruction: instruction,
      responseText: "1. Visible Benefit\nUseful.\n\n2. Operational Benefit\nFaster.\n\n3. Risk to Watch\nErrors.",
      intent,
    });
    expect(result.defects.some((defect) => defect.code === "MISSING_LITERAL_HEADING")).toBe(false);
    expect(result.defects.some((defect) => defect.code === "WRONG_LITERAL_HEADING_ORDER")).toBe(false);
  });

  it("requires exact requested output structure", () => {
    const intent = classifyStreamsIntent({ userMessage: "Return only valid JSON with the answer." });
    const result = judgeStreamsResponse({
      userInstruction: "Return only valid JSON with the answer.",
      responseText: "The answer is yes.",
      intent,
    });
    expect(result.accepted).toBe(false);
    expect(result.defects.some((defect) => defect.code === "INVALID_JSON")).toBe(true);
  });

  it("never persists or completes a rejected response", async () => {
    const turn = await prepareAuthoritativeStreamsTurn({
      scope,
      sessionId: "",
      userMessage: "Return only valid JSON with the answer.",
      recentMessages: [],
    });
    const persistAccepted = vi.fn();
    await expect(executeAuthoritativeStreamsTurn({
      turn,
      generate: async () => ({ content: "not json", citationCount: 0, webSearchUsed: false }),
      judgeWithModel: async () => 0,
      repairWithModel: async () => ({ content: "still not json", citationCount: 0, webSearchUsed: false }),
      persistAccepted,
    })).rejects.toThrow("STREAMS_RESPONSE_REJECTED");
    expect(persistAccepted).not.toHaveBeenCalled();
  });

  it("uses default project context and server-only evidence", async () => {
    const turn = await prepareAuthoritativeStreamsTurn({
      scope,
      sessionId: "",
      userMessage: "Explain the project status.",
      recentMessages: [],
    });
    expect(turn.projectId).toBe("project-default");
    expect(turn.context.toolEvidence).toEqual([]);
    expect(turn.context.tokenBudget.maxTokens).toBeGreaterThan(10000);
  });

  it("routes active chat through the authoritative execution controller", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/streams-ai/routes/messages-memory-active.ts"), "utf8");
    const apiRoute = readFileSync(resolve(process.cwd(), "src/app/api/streams-ai/messages/route.ts"), "utf8");
    expect(source).toContain("prepareAuthoritativeStreamsTurn");
    expect(source).toContain("executeAuthoritativeStreamsTurn");
    expect(source).toContain("judgeCandidatesWithModel");
    expect(source).toContain("repairCandidateWithModel");
    expect(source).toContain("persistAccepted");
    expect(source).not.toContain("metadata?.toolEvidence");
    expect(apiRoute).not.toContain("collectSseResponse");
    expect(apiRoute).not.toContain("persistRepairedTurn");
  });

  it("renders one message action row per assistant message ID", () => {
    const markdown = readFileSync(resolve(process.cwd(), "src/components/streams-ai/current-chat/new-face/markdown/ChatMarkdownMessage.jsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx"), "utf8");
    expect(markdown).not.toContain("ResponseActions");
    expect(markdown).not.toContain("chatResponseFooter");
    expect(shell).toContain("<MessageActions message={message}");
    expect(shell).toContain("seen.has(id)");
  });
});
