import { describe, expect, it } from "vitest";
import { classifyStreamsTask } from "@/lib/streams-ai/runtime/task-complexity-classifier";

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
});
