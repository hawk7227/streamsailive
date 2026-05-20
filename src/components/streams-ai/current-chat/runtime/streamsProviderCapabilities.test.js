import { describe, expect, it } from "vitest";
import { getProvidersForMode, providerSupportsMode } from "./streamsProviderCapabilities";

describe("streamsProviderCapabilities", () => {
  it("maps provider capabilities", () => {
    expect(providerSupportsMode("runway", "image_to_video")).toBe(true);
    expect(providerSupportsMode("elevenlabs", "text_to_video")).toBe(false);
  });

  it("returns providers for a mode", () => {
    expect(getProvidersForMode("image_to_video")).toEqual(expect.arrayContaining(["auto", "runway", "kling", "veo", "fal"]));
  });
});
