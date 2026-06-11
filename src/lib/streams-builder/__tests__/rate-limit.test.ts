import { describe, expect, it, beforeEach } from "vitest";
import { checkStreamsBuilderRateLimit, clearStreamsBuilderRateLimits } from "../rate-limit";

describe("Streams Builder rate limit", () => {
  beforeEach(() => clearStreamsBuilderRateLimits());

  it("allows requests within the limit", () => {
    const result = checkStreamsBuilderRateLimit({ key: "user:action", limit: 2, windowMs: 1000 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks requests over the limit", () => {
    checkStreamsBuilderRateLimit({ key: "user:action", limit: 1, windowMs: 1000 });
    const result = checkStreamsBuilderRateLimit({ key: "user:action", limit: 1, windowMs: 1000 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });
});
