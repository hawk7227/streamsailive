// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { classifyStreamsIntent } from "../src/lib/streams-ai/runtime/intent-engine";
import { validateStreamsEvidence } from "../src/lib/streams-ai/quality/evidence-validator";
import { validateDeterministicStreamsOutput } from "../src/lib/streams-ai/quality/deterministic-output-validator";
import { validateResponseStructure } from "../src/lib/streams-ai/routes/response-structure-validator";
import { executeAuthoritativeStreamsTurn, prepareAuthoritativeStreamsTurn } from "../src/lib/streams-ai/runtime/authoritative-turn-controller";

const scope = {
  tenantId: "tenant-1",
  userId: "user-1",
  defaultProjectId: "project-default",
  workspaceId: "streams-ai" as const,
  moduleId: "streams-ai-core" as const,
  productId: "streams-ai" as const,
};

describe("Streams Stage 2 quality enforcement", () => {
  it("allows a truthful refusal for an unverified action but rejects a false completion claim", () => {
    const intent = classifyStreamsIntent({ userMessage: "Deploy the app to production." });
    const refusal = validateStreamsEvidence({ intent, responseText: "I cannot claim the app was deployed because no verified deployment receipt is available.", webSearchUsed: false, citationCount: 0, verifiedToolEvidenceCount: 0 });
    expect(refusal.accepted).toBe(true);

    const falseClaim = validateStreamsEvidence({ intent, responseText: "Done. The app is now live.", webSearchUsed: false, citationCount: 0, verifiedToolEvidenceCount: 0 });
    expect(falseClaim.accepted).toBe(false);
    expect(falseClaim.defects.some((defect) => defect.code === "ACTION_WITHOUT_VERIFIED_RECEIPT")).toBe(true);
  });

  it("requires search and citation coverage for current multi-item requests", () => {
    const intent = classifyStreamsIntent({ userMessage: "What are the three most important AI announcements from the last 7 days?" });
    expect(validateStreamsEvidence({ intent, responseText: "Three announcements.", webSearchUsed: false, citationCount: 0, verifiedToolEvidenceCount: 0 }).accepted).toBe(false);
    const insufficient = validateStreamsEvidence({ intent, responseText: "Three announcements.", webSearchUsed: true, citationCount: 1, verifiedToolEvidenceCount: 0 });
    expect(insufficient.defects.some((defect) => defect.code === "INSUFFICIENT_CITATION_COVERAGE")).toBe(true);
    expect(validateStreamsEvidence({ intent, responseText: "Three announcements.", webSearchUsed: true, citationCount: 3, verifiedToolEvidenceCount: 0 }).accepted).toBe(true);
  });

  it("accepts an explicit current-information limitation instead of fabricated recency", () => {
    const intent = classifyStreamsIntent({ userMessage: "Explain the latest API changes without searching the web." });
    const result = validateStreamsEvidence({ intent, responseText: "I cannot verify the latest API changes without a live search.", webSearchUsed: false, citationCount: 0, verifiedToolEvidenceCount: 0 });
    expect(result.accepted).toBe(true);
  });

  it("enforces raw JSON, exact keys, and key order", () => {
    const instruction = [
      "Return only valid JSON using exactly this structure:",
      "{",
      '  "benefit": "string",',
      '  "risk": "string",',
      '  "recommendation": "string"',
      "}",
      "Do not include Markdown or any text outside the JSON.",
    ].join("\n");
    const intent = classifyStreamsIntent({ userMessage: instruction });
    expect(validateDeterministicStreamsOutput({ instruction, responseText: '```json\n{"benefit":"a","risk":"b","recommendation":"c"}\n```', intent }).accepted).toBe(false);
    expect(validateDeterministicStreamsOutput({ instruction, responseText: '{"risk":"b","benefit":"a","recommendation":"c"}', intent }).accepted).toBe(false);
    expect(validateDeterministicStreamsOutput({ instruction, responseText: '{"benefit":"a","risk":"b","recommendation":"c"}', intent }).accepted).toBe(true);
  });

  it("enforces exact table columns, order, row count, and table-only output", () => {
    const instruction = [
      "Return only a Markdown table with exactly these columns in this order:",
      "Option | Cost | Difficulty | Expected Impact | Risk",
      "Include exactly 3 rows.",
    ].join("\n");
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const wrong = "Intro\n\n| Cost | Option | Difficulty | Expected Impact | Risk |\n|---|---|---|---|---|\n| Low | A | Easy | High | Low |";
    const wrongResult = validateDeterministicStreamsOutput({ instruction, responseText: wrong, intent });
    expect(wrongResult.accepted).toBe(false);
    expect(wrongResult.defects.some((defect) => defect.code === "WRONG_TABLE_COLUMNS")).toBe(true);
    expect(wrongResult.defects.some((defect) => defect.code === "WRONG_TABLE_ROW_COUNT")).toBe(true);

    const correct = "| Option | Cost | Difficulty | Expected Impact | Risk |\n|---|---|---|---|---|\n| A | Low | Easy | High | Low |\n| B | Medium | Medium | Medium | Medium |\n| C | High | Hard | High | High |";
    expect(validateDeterministicStreamsOutput({ instruction, responseText: correct, intent }).accepted).toBe(true);
  });

  it("does not force tables, code blocks, or blockquotes on screenshot reviews unless requested", () => {
    const instruction = "Review this screenshot. Use exactly: 1. Visible Content 2. Interpretation 3. Verification Note.";
    const response = "1. Visible Content\nThe screenshot shows a dashboard.\n\n2. Interpretation\nThis may indicate normal status.\n\n3. Verification Note\nThe screenshot does not independently verify operation.";
    const result = validateResponseStructure(instruction, response);
    expect(result.missing).not.toContain("Markdown table");
    expect(result.missing).not.toContain("fenced code block");
    expect(result.missing).not.toContain("blockquote");
  });

  it("returns a clarification for mutually exclusive exact formats", () => {
    const instruction = "Return only valid JSON. Also return a Markdown table outside the JSON. Do both exactly.";
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const bad = validateDeterministicStreamsOutput({ instruction, responseText: '{"answer":"x"}', intent });
    expect(bad.accepted).toBe(false);
    expect(bad.defects.some((defect) => defect.code === "CONFLICTING_EXACT_FORMATS")).toBe(true);
    const clarification = validateDeterministicStreamsOutput({ instruction, responseText: "These exact requirements are mutually exclusive. Which single format should control: JSON or Markdown table?", intent });
    expect(clarification.accepted).toBe(true);
  });

  it("never persists a candidate that remains deterministically invalid after bounded repair", async () => {
    const instruction = "Return only valid JSON with exactly these keys: {\"benefit\":\"string\",\"risk\":\"string\"}";
    const turn = await prepareAuthoritativeStreamsTurn({ scope, sessionId: "", userMessage: instruction, recentMessages: [] });
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
});
