// @vitest-environment node

import { describe, expect, it } from "vitest";
import { assessStreamsParityQuality } from "../src/lib/streams-ai/intelligence/parity-quality";
import { buildStreamsParityPlan, buildStreamsParitySystemPrompt, STREAMS_PARITY_PROFILE_VERSION } from "../src/lib/streams-ai/intelligence/parity-profile";

describe("Streams ChatGPT Claude parity runtime", () => {
  it("uses a versioned parity system profile", () => {
    const prompt = buildStreamsParitySystemPrompt("2026-07-14T00:00:00.000Z");
    expect(STREAMS_PARITY_PROFILE_VERSION).toBe("streams-unified-parity-v1");
    expect(prompt).toContain("closest technically achievable equivalent");
    expect(prompt).toContain("Match intent interpretation");
    expect(prompt).toContain("do not compress it");
  });

  it("builds exhaustive and exact-format response plans", () => {
    const plan = buildStreamsParityPlan({
      userInstruction: "Generate the full non-condensed answer in an exact table with these columns.",
      mode: "reasoning",
      hasFiles: true,
      hasMemory: true,
    });
    expect(plan).toContain("Response depth: exhaustive");
    expect(plan).toContain("Exact structure required: yes");
    expect(plan).toContain("Resolved mode: reasoning");
  });

  it("passes a direct grounded response", () => {
    const result = assessStreamsParityQuality({
      userInstruction: "Explain why the deployment failed.",
      assistantContent: "The deployment failed because the build log reports a missing required environment variable. The repository state and deployment logs are needed to verify the complete root cause.",
      usedRuntimeContext: true,
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("flags generic filler and unsupported action claims", () => {
    const result = assessStreamsParityQuality({
      userInstruction: "Fix the deployment.",
      assistantContent: "Certainly, I successfully deployed the fix. Let me know if you need anything else.",
      usedRuntimeContext: false,
    });
    expect(result.passed).toBe(false);
    expect(result.flags).toContain("generic_opening");
    expect(result.flags).toContain("generic_closing");
    expect(result.flags).toContain("unverified_action_claim");
  });

  it("flags image overstatement and missing attribution", () => {
    const result = assessStreamsParityQuality({
      userInstruction: "Review the screenshot.",
      assistantContent: "The application is definitely fully working and secure.",
      hasImages: true,
    });
    expect(result.passed).toBe(false);
    expect(result.flags).toContain("image_claim_overstated");
    expect(result.flags).toContain("image_attribution_missing");
  });
});
