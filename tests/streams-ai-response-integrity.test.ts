// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  requiresDeterministicStructureCheck,
  validateResponseStructure,
} from "../src/lib/streams-ai/routes/response-structure-validator";
import { MESSAGE_ACTIONS } from "../src/lib/streams-ai/repositories/message-actions-repository";

const canonicalScreenshotResponse = [
  "The screenshot shows a deployment dashboard.",
  "",
  "| Visible claim | Verified by screenshot? | Evidence still required |",
  "|---|---|---|",
  "| Deployment marked ready | Visible only | Deployment logs and live testing |",
  "",
  "```text",
  "Visible status: Ready",
  "```",
  "",
  "> The screenshot does not independently verify functional correctness.",
  "",
  "Verification requires current deployment logs, source history, and live application testing.",
].join("\n");

describe("STREAMS AI response integrity", () => {
  it("forces attachment-only screenshot reviews through the deterministic gate", () => {
    expect(requiresDeterministicStructureCheck("\u200B")).toBe(true);
    expect(validateResponseStructure("\u200B", canonicalScreenshotResponse)).toEqual({ valid: true, missing: [] });
  });

  it("rejects screenshot responses missing canonical structure", () => {
    const result = validateResponseStructure("Review the attached screenshot.", "The screenshot shows a dashboard.");
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("Markdown table");
    expect(result.missing).toContain("fenced code block");
    expect(result.missing).toContain("blockquote");
    expect(result.missing).toContain("verification note");
  });

  it("rejects generic follow-up filler", () => {
    const result = validateResponseStructure(
      "Review the attached screenshot.",
      `${canonicalScreenshotResponse}\n\nPlease let me know if you need anything else.`,
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("remove generic follow-up filler");
  });

  it("uses a strict message action allowlist", () => {
    expect(MESSAGE_ACTIONS.has("regenerate")).toBe(true);
    expect(MESSAGE_ACTIONS.has("branch")).toBe(true);
    expect(MESSAGE_ACTIONS.has("feedback_up")).toBe(true);
    expect(MESSAGE_ACTIONS.has("delete_everything" as never)).toBe(false);
  });

  it("does not ship the legacy DOM mutation message-action bridge", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/streams-ai/current-chat/new-face/message-actions/MessageActionBridge.jsx"), "utf8");
    expect(source).not.toContain("MutationObserver");
    expect(source).not.toContain("querySelectorAll");
    expect(source).toContain("ChatScrollController");
  });

  it("keeps image detection and idempotency server-side", () => {
    const messagesRoute = readFileSync(resolve(process.cwd(), "src/app/api/streams-ai/messages/route.ts"), "utf8");
    const repository = readFileSync(resolve(process.cwd(), "src/lib/streams-ai/repositories/messages-repository.ts"), "utf8");
    expect(messagesRoute).toContain("hasImageAttachment");
    expect(messagesRoute).toContain("structuredResponse");
    expect(repository).toContain("findByIdempotencyKey");
    expect(repository).toContain("idempotency_key");
  });

  it("uses event-driven scroll restoration without a fixed settle timer", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/streams-ai/current-chat/new-face/scroll/ChatScrollController.jsx"), "utf8");
    expect(source).not.toContain("INITIAL_SETTLE_MS");
    expect(source).toContain("document.fonts?.ready");
    expect(source).toContain("waitForCurrentMedia");
    expect(source).toContain("New messages ↓");
  });

  it("preserves the full two-row console on the new-chat landing", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/streams-ai/StreamsAIDesktopVisualBridge.jsx"), "utf8");
    expect(source).toContain(".operatorNewChatLanding .operatorLandingComposer .streamsComposer");
    expect(source).toContain("min-height: 96px !important");
    expect(source).toContain('grid-template-areas:\n            "tools input input send"\n            ". mode mic send"');
    expect(source).toContain("width: 58px !important");
    expect(source).toContain("height: 58px !important");
  });
});
