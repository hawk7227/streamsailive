// @vitest-environment node

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  requiresDeterministicStructureCheck,
  validateResponseStructure,
} from "../src/lib/streams-ai/routes/response-structure-validator";
import { buildDeterministicScreenshotResponse } from "../src/lib/streams-ai/routes/structured-response-service";
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

  it("builds a valid deterministic screenshot response when repair infrastructure fails", () => {
    const output = buildDeterministicScreenshotResponse("The screenshot displays a dashboard with a visible Ready label. Please let me know if you need anything else.");
    const validation = validateResponseStructure("Review the attached screenshot.", output);
    expect(validation).toEqual({ valid: true, missing: [] });
    expect(output).toContain("| Visible claim | Verified by screenshot? | Evidence still required |");
    expect(output).toContain("```text");
    expect(output).toContain("> The screenshot does not independently verify");
    expect(output).not.toContain("Please let me know");
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
    expect(repository).toContain("isIntegritySchemaDrift");
    expect(repository).toContain("compatibility message");
  });

  it("uses event-driven scroll restoration without a fixed settle timer", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/streams-ai/current-chat/new-face/scroll/ChatScrollController.jsx"), "utf8");
    expect(source).not.toContain("INITIAL_SETTLE_MS");
    expect(source).toContain("document.fonts?.ready");
    expect(source).toContain("waitForCurrentMedia");
    expect(source).toContain("New messages ↓");
  });

  it("removes the legacy desktop console runtime completely", () => {
    const rootPage = readFileSync(resolve(process.cwd(), "src/app/streams-ai/page.tsx"), "utf8");
    const sessionPage = readFileSync(resolve(process.cwd(), "src/app/streams-ai/[sessionId]/page.tsx"), "utf8");
    const activeCss = readFileSync(resolve(process.cwd(), "src/components/streams-ai/visual-operator/streams-operator-shell.css"), "utf8");

    expect(existsSync(resolve(process.cwd(), "src/app/streams-ai/StreamsAIDesktopVisualBridge.jsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/streams-ai/StreamsAIEmptyComposerPositionBridge.jsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/streams-ai/StreamsAIDesktopConsole.module.css"))).toBe(false);
    expect(rootPage).not.toContain("StreamsAIDesktopVisualBridge");
    expect(rootPage).not.toContain("StreamsAIEmptyComposerPositionBridge");
    expect(sessionPage).not.toContain("StreamsAIDesktopVisualBridge");
    expect(sessionPage).not.toContain("StreamsAIEmptyComposerPositionBridge");
    expect(activeCss).toContain(".operatorLandingComposer .streamsComposer");
    expect(activeCss).toContain("min-height:52px!important");
  });

  it("targets the active operator shell on mobile", () => {
    const mobileCss = readFileSync(resolve(process.cwd(), "src/app/streams-ai/StreamsAIMobileChat.module.css"), "utf8");
    const keyboardBridge = readFileSync(resolve(process.cwd(), "src/app/streams-ai/StreamsAIMobileKeyboardBridge.jsx"), "utf8");

    expect(mobileCss).toContain(":global(.streamsOperator)");
    expect(mobileCss).toContain("env(safe-area-inset-bottom)");
    expect(mobileCss).toContain("operatorMobileDrawer");
    expect(mobileCss).not.toContain(".shell.mobile");
    expect(keyboardBridge).toContain(".streamsOperator");
    expect(keyboardBridge).toContain("visualViewport");
    expect(keyboardBridge).not.toContain(".shell.mobile");
  });

  it("shows attachment-only user content and live assistant activity", () => {
    const runtime = readFileSync(resolve(process.cwd(), "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx"), "utf8");
    const messageCss = readFileSync(resolve(process.cwd(), "src/components/streams-ai/visual-operator/streams-operator-message-states.css"), "utf8");

    expect(runtime).toContain("Review the attached file.");
    expect(runtime).toContain("Checking the reference image…");
    expect(runtime).toContain("completed || !receivedText");
    expect(shell).toContain("MessageAttachments");
    expect(shell).toContain("PendingAssistant");
    expect(shell).toContain("!isUser && !failed");
    expect(messageCss).toContain("operatorPendingDots");
    expect(messageCss).toContain("operatorAttachmentImage");
  });
});
