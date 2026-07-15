import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAuthorizedInternalChatOperation } from "@/lib/streams-ai/repositories/jobs-repository";

describe("Streams AI first-message console transition", () => {
  it("recognizes the zero-credit internal narration record as already chat-authorized", () => {
    expect(isAuthorizedInternalChatOperation({
      kind: "chat_tool",
      productId: "streams-ai",
      creditEstimate: 0,
      inputJson: { purpose: "streams_ai_chat_operation" },
    })).toBe(true);
  });

  it("does not bypass entitlement for paid or unrelated jobs", () => {
    expect(isAuthorizedInternalChatOperation({
      kind: "image_generation",
      productId: "text-2-image",
      creditEstimate: 1,
      inputJson: { purpose: "streams_ai_chat_operation" },
    })).toBe(false);
  });

  it("keeps the same composer geometry before and after the first message", () => {
    const css = readFileSync("src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css", "utf8");
    expect(css).toContain(".startWorkspace .startComposerWrap");
    expect(css).toContain(".startWorkspaceActive .startComposerWrap");
    expect(css).toContain("bottom: 92px !important");
    expect(css).toContain("width: min(860px, calc(100% - 96px)) !important");
  });

  it("keeps work history above the composer instead of overlapping it", () => {
    const css = readFileSync("src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css", "utf8");
    expect(css).toContain(".streamsAIWorkHistory");
    expect(css).toContain("bottom: 228px !important");
  });
});
