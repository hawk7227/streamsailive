import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyStreamsTask } from "@/lib/streams-ai/runtime/task-complexity-classifier";

const jobsSource = readFileSync("src/lib/streams-ai/repositories/jobs-repository.ts", "utf8");
const layoutCss = readFileSync("src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css", "utf8");

describe("Streams AI first-response planning", () => {
  it("keeps a simple factual request direct", () => {
    const result = classifyStreamsTask({ message: "What is photosynthesis?" });
    expect(result.classification).toBe("simple");
    expect(result.requiresNarration).toBe(false);
    expect(result.phases).toEqual([]);
  });

  it("classifies repository inspection, implementation, and verification as multi-step", () => {
    const result = classifyStreamsTask({ message: "Inspect the existing repository, reuse the current route, implement the missing frontend and backend wiring, then run tests and verify deployment." });
    expect(result.requiresNarration).toBe(true);
    expect(["multi_step", "side_effecting", "long_running"]).toContain(result.classification);
    expect(result.phases.map((phase) => phase.id)).toContain("inspect");
    expect(result.phases.map((phase) => phase.id)).toContain("implement");
    expect(result.phases.map((phase) => phase.id)).toContain("verify");
  });

  it("records preservation constraints and material risks", () => {
    const result = classifyStreamsTask({ message: "Update the API and database persistence but keep the existing UI unchanged and reuse the current routes." });
    expect(result.preservedItems.length).toBeGreaterThan(0);
    expect(result.risksAvoided).toContain("duplicating or bypassing existing infrastructure");
  });

  it("classifies long non-condensed work as long-running", () => {
    const result = classifyStreamsTask({ message: "Generate a complete non-condensed audit of all 40 production capabilities and verify every section." });
    expect(result.classification).toBe("long_running");
    expect(result.requiresNarration).toBe(true);
  });

  it("uses multiple attachments as a multi-step signal", () => {
    const result = classifyStreamsTask({ message: "Review these files.", attachments: [{ id: "a" }, { id: "b" }] });
    expect(result.requiresNarration).toBe(true);
    expect(result.phases[0]?.id).toBe("inspect");
  });

  it("does not put unsupported findings or completion language into the initial plan", () => {
    const result = classifyStreamsTask({ message: "Inspect the existing code, find what is missing, implement it, and test it." });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/I found|confirmed|tests passed|completed successfully/i);
    expect(result.nextAction).toMatch(/Inspect/i);
  });

  it("reuses the already-authorized scope only for zero-credit internal chat narration", () => {
    expect(jobsSource).toContain("input.inputJson?.purpose === \"streams_ai_chat_operation\"");
    expect(jobsSource).toContain("input.creditEstimate === 0");
    expect(jobsSource).toContain("capability.entitlementRequired && !internalChatOperation");
    expect(jobsSource).toContain("input.productId !== \"text-2-image\"");
    expect(jobsSource).toContain("input.productId !== \"photo-2-motion\"");
    expect(jobsSource).toContain("input.productId !== \"text-2-video\"");
  });

  it("keeps only the compact one-line composer in both chat states", () => {
    expect(layoutCss).toContain(".startWorkspace .startComposerWrap");
    expect(layoutCss).toContain(".startWorkspaceActive .startComposerWrap");
    expect(layoutCss).toContain("bottom: max(24px, env(safe-area-inset-bottom, 0px)) !important");
    expect(layoutCss).toContain("width: min(860px, calc(100% - 96px)) !important");
    expect(layoutCss).toContain(".startComposerWrap .streamsComposerLiveStatus");
    expect(layoutCss).toContain("display: none !important");
    expect(layoutCss).toContain("flex-wrap: nowrap !important");
    expect(layoutCss).toContain("min-height: 58px !important");
  });

  it("keeps the conversation viewport visible above the compact console", () => {
    expect(layoutCss).toContain(".startWorkspaceActive .startChatSurface");
    expect(layoutCss).toContain("bottom: 112px !important");
    expect(layoutCss).toContain("overflow-y: auto !important");
    expect(layoutCss).toContain("justify-content: flex-start !important");
  });

  it("keeps the authoritative Stop control visible above the composer", () => {
    expect(layoutCss).toContain(".streamsAIWorkHistory__stop");
    expect(layoutCss).toContain("z-index: 8 !important");
    expect(layoutCss).toContain("pointer-events: auto !important");
    expect(layoutCss).toContain("cursor: pointer !important");
  });
});
