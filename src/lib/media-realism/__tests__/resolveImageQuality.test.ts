/**
 * src/lib/media-realism/__tests__/resolveImageQuality.test.ts
 *
 * Guards against the gpt-image quality regression:
 *   "standard" and "hd" are dall-e-3 values — invalid for gpt-image-1.x.
 *   Passing them causes a provider 400 and silent image generation failure.
 */

import { describe, it, expect } from "vitest";
import { resolveImageQuality, isGPTImageModel } from "../resolveImageQuality";

describe("isGPTImageModel", () => {
  it("accepts gpt-image-1", () => {
    expect(isGPTImageModel("gpt-image-1")).toBe(true);
  });

  it("accepts gpt-image-1.5", () => {
    expect(isGPTImageModel("gpt-image-1.5")).toBe(true);
  });

  it("rejects dall-e-3", () => {
    expect(isGPTImageModel("dall-e-3")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isGPTImageModel("")).toBe(false);
  });
});

describe("gpt-image-1.5 quality contract", () => {
  it("accepts high quality", () => {
    expect(resolveImageQuality("gpt-image-1.5", "high", "medium")).toBe("high");
  });

  it("accepts medium quality", () => {
    expect(resolveImageQuality("gpt-image-1.5", "medium", "medium")).toBe("medium");
  });

  it("accepts low quality", () => {
    expect(resolveImageQuality("gpt-image-1.5", "low", "medium")).toBe("low");
  });

  it("accepts auto quality", () => {
    expect(resolveImageQuality("gpt-image-1.5", "auto", "medium")).toBe("auto");
  });

  it("falls back from invalid 'standard' (dall-e-3 value)", () => {
    expect(resolveImageQuality("gpt-image-1.5", "standard", "medium")).toBe("medium");
  });

  it("falls back from invalid 'hd' (dall-e-3 value)", () => {
    expect(resolveImageQuality("gpt-image-1.5", "hd", "medium")).toBe("medium");
  });

  it("falls back when quality is undefined", () => {
    expect(resolveImageQuality("gpt-image-1.5", undefined, "medium")).toBe("medium");
  });
});

describe("gpt-image-1 quality contract (regression — same contract as 1.5)", () => {
  it("falls back from 'standard'", () => {
    expect(resolveImageQuality("gpt-image-1", "standard", "medium")).toBe("medium");
  });

  it("accepts 'high'", () => {
    expect(resolveImageQuality("gpt-image-1", "high", "medium")).toBe("high");
  });
});
