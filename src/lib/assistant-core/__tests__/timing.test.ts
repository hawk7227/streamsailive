/**
 * src/lib/assistant-core/__tests__/timing.test.ts
 *
 * Unit tests for TurnTimer — validates TEST 8 (TURN_TIMING log coverage).
 * No network. Pure timing logic.
 */

import { describe, it, expect, vi } from "vitest";
import { TurnTimer } from "../timing";

describe("TurnTimer — structured log output (TEST 8)", () => {
  it("flush emits a JSON log line with required fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const timer = new TurnTimer("turn_test_001");
    timer.mark("context_built");
    timer.mark("openai_called");
    timer.mark("first_text_ready");
    timer.annotate({ route: "chat", model: "gpt-4o-mini", had_file_ctx: false });
    timer.mark("turn_complete");
    timer.flush();

    expect(spy).toHaveBeenCalledTimes(1);
    const logArg = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logArg);

    expect(parsed.event).toBe("TURN_TIMING");
    expect(parsed.turnId).toBe("turn_test_001");
    expect(typeof parsed.context_ms).toBe("number");
    expect(typeof parsed.openai_ms).toBe("number");
    expect(typeof parsed.total_ms).toBe("number");
    expect(typeof parsed.met_200ms_target).toBe("boolean");
    expect(parsed.route).toBe("chat");
    expect(parsed.model).toBe("gpt-4o-mini");
    expect(parsed.had_file_ctx).toBe(false);

    spy.mockRestore();
  });

  it("context_ms = 0 when context_built not marked", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const timer = new TurnTimer("turn_no_ctx");
    timer.mark("turn_complete");
    timer.flush();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.context_ms).toBeNull();
    spy.mockRestore();
  });

  it("openai_ms is null when first_text_ready not marked", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const timer = new TurnTimer("turn_no_openai");
    timer.mark("context_built");
    timer.mark("openai_called");
    // never marks first_text_ready
    timer.mark("turn_complete");
    timer.flush();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.openai_ms).toBeNull();
    spy.mockRestore();
  });

  it("multiple annotate calls merge fields correctly", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const timer = new TurnTimer("turn_multi_annotate");
    timer.annotate({ route: "image", model: "gpt-4o-mini" });
    timer.annotate({ escalated: true, continuation_model: "gpt-4.1" });
    timer.mark("turn_complete");
    timer.flush();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.route).toBe("image");
    expect(parsed.model).toBe("gpt-4o-mini");
    expect(parsed.escalated).toBe(true);
    expect(parsed.continuation_model).toBe("gpt-4.1");
    spy.mockRestore();
  });

  it("total_ms is always present and >= 0", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const timer = new TurnTimer("turn_total");
    timer.mark("turn_complete");
    timer.flush();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.total_ms).toBeGreaterThanOrEqual(0);
    spy.mockRestore();
  });
});
