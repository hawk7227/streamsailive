import { describe, expect, it } from "vitest";
import {
  getCapabilityProduct,
  recommendCapabilityFromText,
} from "../src/lib/streams-ai/capabilities/capability-products";
import {
  buildRuntimeCapabilityRegistry,
  isCanonicalCapabilityQuestion,
  wantsNonCompressedCapabilities,
} from "../src/lib/streams-ai/capabilities/canonical-capabilities";

describe("STREAMS AI production contracts", () => {
  it("routes capability questions to the canonical capability source", () => {
    expect(isCanonicalCapabilityQuestion("What are your capabilities? Give me the non-compressed list.")).toBe(true);
    expect(wantsNonCompressedCapabilities("Give me the full non consolidated answer")).toBe(true);
  });

  it("keeps the canonical capability registry proof-classified without unproven entries", () => {
    const registry = buildRuntimeCapabilityRegistry();
    expect(registry.total).toBeGreaterThan(20);
    expect(registry.statusCounts.wired).toBeGreaterThan(0);
    expect(registry.statusCounts.implemented_unproven).toBe(0);
    expect(registry.capabilities.every((capability) => capability.id && capability.title && capability.summary && capability.status && capability.proof)).toBe(true);
  });

  it("maps image generation requests to the image capability product", () => {
    const product = recommendCapabilityFromText("Generate a product photo for my store");
    expect(product.kind).toBe("image_generation");
    expect(product.productId).toBe("text-2-image");
    expect(product.estimatedCredits).toBeGreaterThan(0);
  });

  it("does not collapse blocked media modes into fake wired states", () => {
    expect(getCapabilityProduct("text_to_video").executionStatus).toBe("blocked");
    expect(getCapabilityProduct("voice_generation").executionStatus).toBe("blocked");
  });
});