// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { classifyStreamsIntent } from "../src/lib/streams-ai/runtime/intent-engine";
import { enforceLiteralRequestedHeadings } from "../src/lib/streams-ai/quality/literal-heading-enforcer";
import { executeAuthoritativeStreamsTurn, prepareAuthoritativeStreamsTurn } from "../src/lib/streams-ai/runtime/authoritative-turn-controller";

const scope = {
  tenantId: "tenant-1",
  userId: "user-1",
  defaultProjectId: "project-default",
  workspaceId: "streams-ai" as const,
  moduleId: "streams-ai-core" as const,
  productId: "streams-ai" as const,
};

const instruction = [
  "Give me a short 3-section answer about why businesses should use AI.",
  "Use exactly these section headings:",
  "1. Visible Benefit",
  "2. Operational Benefit",
  "3. Risk to Watch",
  "Keep it concise.",
].join("\n");

describe("Streams deterministic literal heading enforcement", () => {
  it("replaces unnumbered semantic heading lines with exact requested literals", () => {
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const result = enforceLiteralRequestedHeadings(
      "## Visible Benefit\nUseful.\n\nOperational Benefit\nFaster.\n\n**Risk to Watch**\nErrors.",
      intent,
    );
    expect(result.content).toContain("1. Visible Benefit");
    expect(result.content).toContain("2. Operational Benefit");
    expect(result.content).toContain("3. Risk to Watch");
    expect(result.content).not.toMatch(/^#{1,6}\s+Visible Benefit/m);
  });

  it("preserves already-correct literal headings", () => {
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const content = "1. Visible Benefit\nUseful.\n\n2. Operational Benefit\nFaster.\n\n3. Risk to Watch\nErrors.";
    expect(enforceLiteralRequestedHeadings(content, intent)).toMatchObject({ content, changed: false });
  });

  it("persists only the deterministically corrected candidate", async () => {
    const turn = await prepareAuthoritativeStreamsTurn({ scope, sessionId: "", userMessage: instruction, recentMessages: [] });
    const persistAccepted = vi.fn(async ({ candidate }) => ({ assistantMessageId: "assistant-1", content: candidate.content }));
    const result = await executeAuthoritativeStreamsTurn({
      turn,
      generate: async () => ({
        content: "Visible Benefit\nUseful.\n\nOperational Benefit\nFaster.\n\nRisk to Watch\nErrors.",
        citationCount: 0,
        webSearchUsed: false,
      }),
      judgeWithModel: async () => 0,
      repairWithModel: async () => ({
        content: "Visible Benefit\nUseful.\n\nOperational Benefit\nFaster.\n\nRisk to Watch\nErrors.",
        citationCount: 0,
        webSearchUsed: false,
      }),
      persistAccepted,
    });
    expect(result.candidate.content).toContain("1. Visible Benefit");
    expect(result.candidate.content).toContain("2. Operational Benefit");
    expect(result.candidate.content).toContain("3. Risk to Watch");
    expect(persistAccepted).toHaveBeenCalledTimes(1);
    expect(persistAccepted.mock.calls[0][0].candidate.content).toBe(result.candidate.content);
  });
});
