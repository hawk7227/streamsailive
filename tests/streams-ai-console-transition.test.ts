import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const jobsSource = readFileSync("src/lib/streams-ai/repositories/jobs-repository.ts", "utf8");
const layoutCss = readFileSync("src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css", "utf8");

describe("Streams AI first-message console transition", () => {
  it("reuses the already-authorized scope only for zero-credit internal chat narration", () => {
    expect(jobsSource).toContain("input.inputJson?.purpose === \"streams_ai_chat_operation\"");
    expect(jobsSource).toContain("input.creditEstimate === 0");
    expect(jobsSource).toContain("capability.entitlementRequired && !internalChatOperation");
  });

  it("keeps paid and unrelated jobs behind their normal entitlement checks", () => {
    expect(jobsSource).toContain("input.productId !== \"text-2-image\"");
    expect(jobsSource).toContain("input.productId !== \"photo-2-motion\"");
    expect(jobsSource).toContain("input.productId !== \"text-2-video\"");
  });

  it("keeps the same composer geometry before and after the first message", () => {
    expect(layoutCss).toContain(".startWorkspace .startComposerWrap");
    expect(layoutCss).toContain(".startWorkspaceActive .startComposerWrap");
    expect(layoutCss).toContain("bottom: 92px !important");
    expect(layoutCss).toContain("width: min(860px, calc(100% - 96px)) !important");
  });

  it("keeps the conversation viewport visible above the composer", () => {
    expect(layoutCss).toContain(".startWorkspaceActive .startChatSurface");
    expect(layoutCss).toContain("bottom: 208px !important");
    expect(layoutCss).toContain("overflow-y: auto !important");
    expect(layoutCss).toContain("justify-content: flex-start !important");
  });

  it("keeps work history above the composer instead of overlapping it", () => {
    expect(layoutCss).toContain(".streamsAIWorkHistory");
    expect(layoutCss).toContain("bottom: 228px !important");
  });
});
