import { describe, expect, it } from "vitest";
import { compareVersions, rolloutBucket } from "../src/lib/streams-mobile/feature-flags-repository";
import { STREAMS_RESUMABLE_UPLOAD_LIMITS } from "../src/lib/streams-mobile/resumable-uploads-repository";
import { STREAMS_V1_CORE_ROUTES } from "../src/lib/streams-api/v1-contract";

describe("Streams mobile backend extensions", () => {
  it("publishes all required mobile extension routes", () => {
    expect(STREAMS_V1_CORE_ROUTES).toEqual(expect.arrayContaining([
      "/api/v1/devices",
      "/api/v1/uploads",
      "/api/v1/notifications",
      "/api/v1/feature-flags",
    ]));
  });

  it("compares app versions deterministically", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.0.9", "1.1.0")).toBe(-1);
  });

  it("assigns stable rollout buckets", () => {
    const first = rolloutBucket("feature-a:user-1");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
    expect(rolloutBucket("feature-a:user-1")).toBe(first);
  });

  it("defines bounded resumable upload sizes", () => {
    expect(STREAMS_RESUMABLE_UPLOAD_LIMITS.minChunkBytes).toBeGreaterThanOrEqual(64 * 1024);
    expect(STREAMS_RESUMABLE_UPLOAD_LIMITS.maxChunkBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(STREAMS_RESUMABLE_UPLOAD_LIMITS.maxUploadBytes).toBeGreaterThan(STREAMS_RESUMABLE_UPLOAD_LIMITS.maxChunkBytes);
  });
});
