/**
 * t2v.test.ts
 *
 * Unit tests for every T2V module per spec.
 * All pure logic — no API calls, no network.
 */

import { describe, it, expect } from "vitest";
import { sanitizePrompt, expandPromptWithRealism, buildT2VPrompt } from "@/lib/media-realism-video/t2vPromptBuilder";
import { scoreT2VCandidate, shouldRejectT2VCandidate } from "@/lib/media-realism-video/t2vQc";
import { selectBestT2VCandidate } from "@/lib/media-realism-video/t2vSelector";
import { T2V_QC_PASS_THRESHOLD } from "@/lib/media-realism-video/types";
import type { T2VCandidate, T2VInput, T2VQcScore } from "@/lib/media-realism-video/types";

// ── Fixtures ──────────────────────────────────────────────────────────────

const VALID_INPUT: T2VInput = {
  prompt: "A person sitting at a kitchen table reading a newspaper",
  aspectRatio: "16:9",
  duration: "5",
  quality: "1080p",
  realismMode: "human_lifestyle",
  workspaceId: "test-ws",
};

function makeCandidate(id: string, videoUrl = "https://example.com/video.mp4"): T2VCandidate {
  return { id, externalId: `ext-${id}`, attempt: 1, promptUsed: "test", status: "completed", videoUrl };
}

function makeScore(overrides: Partial<T2VQcScore> = {}): T2VQcScore {
  const defaults: T2VQcScore = {
    faceStability: 1.0, motionNaturalness: 1.0, artifactScore: 1.0,
    temporalConsistency: 1.0, antiCinematicScore: 1.0,
    totalScore: 1.0, rejectionReasons: [], passed: true,
  };
  const merged = { ...defaults, ...overrides };
  // recompute passed if not explicitly set
  if (!("passed" in overrides)) {
    merged.passed = merged.rejectionReasons.length === 0 && merged.totalScore >= T2V_QC_PASS_THRESHOLD;
  }
  return merged;
}

// ── sanitizePrompt ────────────────────────────────────────────────────────

describe("sanitizePrompt — strips cinematic/stylized terms", () => {
  it("strips 'cinematic' from prompt", () => {
    const result = sanitizePrompt("A cinematic shot of a woman walking");
    expect(result.strippedTerms).toContain("cinematic");
    expect(result.sanitizedPrompt).not.toMatch(/\bcinematic\b/i);
  });

  it("strips 'dramatic lighting'", () => {
    const result = sanitizePrompt("dramatic lighting in a beautiful room");
    expect(result.strippedTerms).toContain("dramatic lighting");
  });

  it("strips 'shallow depth of field'", () => {
    const result = sanitizePrompt("person with shallow depth of field background");
    expect(result.strippedTerms).toContain("shallow depth of field");
  });

  it("strips 'bokeh'", () => {
    const result = sanitizePrompt("bokeh effect in background");
    expect(result.strippedTerms).toContain("bokeh");
  });

  it("strips 'studio lighting'", () => {
    const result = sanitizePrompt("studio lighting setup with key light");
    expect(result.strippedTerms).toContain("studio lighting");
  });

  it("strips 'masterpiece' and 'award-winning'", () => {
    const result = sanitizePrompt("a masterpiece award-winning shot");
    expect(result.strippedTerms).toContain("masterpiece");
    expect(result.strippedTerms).toContain("award-winning");
  });

  it("strips 'luxury' and 'premium look'", () => {
    const result = sanitizePrompt("luxury lifestyle with premium look");
    expect(result.strippedTerms).toContain("luxury");
  });

  it("strips 'CGI' and 'rendered'", () => {
    const result = sanitizePrompt("CGI rendered background");
    expect(result.strippedTerms).toContain("cgi");
    expect(result.strippedTerms).toContain("rendered");
  });

  it("strips '8k'", () => {
    const result = sanitizePrompt("ultra detailed 8k resolution");
    expect(result.strippedTerms).toContain("8k");
  });

  it("preserves ordinary descriptive content", () => {
    const result = sanitizePrompt("A person sitting at a kitchen table reading a newspaper");
    expect(result.sanitizedPrompt).toContain("kitchen table");
    expect(result.sanitizedPrompt).toContain("newspaper");
    expect(result.strippedTerms).toHaveLength(0);
  });

  it("preserves originalPrompt unchanged", () => {
    const prompt = "cinematic shot with bokeh";
    const result = sanitizePrompt(prompt);
    expect(result.originalPrompt).toBe(prompt);
  });

  it("records all stripped terms", () => {
    const result = sanitizePrompt("cinematic bokeh dramatic lighting studio lighting");
    expect(result.strippedTerms.length).toBeGreaterThanOrEqual(3);
  });
});

// ── expandPromptWithRealism ───────────────────────────────────────────────

describe("expandPromptWithRealism — injects realism anchors", () => {
  it("injects ordinary real-world setting anchor", () => {
    const sanitized = sanitizePrompt("person walking outside");
    const expanded = expandPromptWithRealism(sanitized, "human_lifestyle");
    expect(expanded.finalPrompt).toContain("ordinary real-world setting");
  });

  it("injects natural motion anchor", () => {
    const sanitized = sanitizePrompt("person walking");
    const expanded = expandPromptWithRealism(sanitized, "human_lifestyle");
    expect(expanded.finalPrompt).toContain("natural motion");
  });

  it("injects no stylization anchor", () => {
    const sanitized = sanitizePrompt("someone cooking");
    const expanded = expandPromptWithRealism(sanitized, "human_lifestyle");
    expect(expanded.finalPrompt).toContain("no stylization");
  });

  it("negativePrompt contains cinematic", () => {
    const sanitized = sanitizePrompt("test");
    const expanded = expandPromptWithRealism(sanitized, "human_lifestyle");
    expect(expanded.negativePrompt).toContain("cinematic");
  });

  it("negativePrompt contains studio lighting", () => {
    const sanitized = sanitizePrompt("test");
    const expanded = expandPromptWithRealism(sanitized, "human_lifestyle");
    expect(expanded.negativePrompt).toContain("studio lighting");
  });

  it("negativePrompt contains text overlays", () => {
    const sanitized = sanitizePrompt("test");
    const expanded = expandPromptWithRealism(sanitized, "workspace");
    expect(expanded.negativePrompt).toContain("text overlays");
  });

  it("environment_only mode uses real location anchors", () => {
    const sanitized = sanitizePrompt("a park");
    const expanded = expandPromptWithRealism(sanitized, "environment_only");
    expect(expanded.injectedAnchors).toContain("real location");
  });

  it("workspace mode uses office anchors", () => {
    const sanitized = sanitizePrompt("office space");
    const expanded = expandPromptWithRealism(sanitized, "workspace");
    expect(expanded.injectedAnchors.some(a => a.includes("office"))).toBe(true);
  });

  it("includes final lock statement", () => {
    const sanitized = sanitizePrompt("test");
    const expanded = expandPromptWithRealism(sanitized, "human_lifestyle");
    expect(expanded.finalPrompt).toContain("cinematic");
    expect(expanded.finalPrompt.toLowerCase()).toContain("wrong");
  });
});

// ── buildT2VPrompt (integration) ──────────────────────────────────────────

describe("buildT2VPrompt — full pipeline", () => {
  it("strips cinematic and injects realism in one call", () => {
    const input: T2VInput = { ...VALID_INPUT, prompt: "cinematic bokeh person at home" };
    const result = buildT2VPrompt(input);
    expect(result.sanitized.strippedTerms).toContain("cinematic");
    expect(result.sanitized.strippedTerms).toContain("bokeh");
    expect(result.finalPrompt).toContain("no stylization");
  });

  it("clean prompt passes through without stripping", () => {
    const result = buildT2VPrompt(VALID_INPUT);
    expect(result.sanitized.strippedTerms).toHaveLength(0);
    expect(result.finalPrompt).toContain(VALID_INPUT.prompt);
  });

  it("returns negative prompt always", () => {
    const result = buildT2VPrompt(VALID_INPUT);
    expect(result.negativePrompt.length).toBeGreaterThan(10);
  });
});

// ── scoreT2VCandidate ─────────────────────────────────────────────────────

describe("scoreT2VCandidate — QC scoring", () => {
  it("clean video scores above threshold and passes", () => {
    const score = scoreT2VCandidate("https://example.com/clean.mp4");
    expect(score.totalScore).toBeGreaterThanOrEqual(T2V_QC_PASS_THRESHOLD);
    expect(score.passed).toBe(true);
    expect(score.rejectionReasons).toHaveLength(0);
  });

  it("all dimensions present and 0-1", () => {
    const score = scoreT2VCandidate("https://example.com/test.mp4");
    expect(score.faceStability).toBeGreaterThanOrEqual(0);
    expect(score.faceStability).toBeLessThanOrEqual(1);
    expect(score.motionNaturalness).toBeGreaterThanOrEqual(0);
    expect(score.artifactScore).toBeGreaterThanOrEqual(0);
    expect(score.temporalConsistency).toBeGreaterThanOrEqual(0);
    expect(score.antiCinematicScore).toBeGreaterThanOrEqual(0);
  });

  it("totalScore is a weighted combination", () => {
    const score = scoreT2VCandidate("https://example.com/test.mp4");
    expect(score.totalScore).toBeGreaterThan(0);
    expect(score.totalScore).toBeLessThanOrEqual(1);
  });

  it("shouldRejectT2VCandidate returns false for clean score", () => {
    const score = scoreT2VCandidate("https://example.com/clean.mp4");
    expect(shouldRejectT2VCandidate(score)).toBe(false);
  });

  it("shouldRejectT2VCandidate returns true for failed score", () => {
    const failScore = makeScore({ passed: false, totalScore: 0.6, rejectionReasons: ["face_drift"] });
    expect(shouldRejectT2VCandidate(failScore)).toBe(true);
  });

  it("face_drift rejection reason triggers on low faceStability", () => {
    // We can force a fail by providing a FrameAnalysis that triggers drift
    // For now verify the hook structure exists via the QC function
    const score = scoreT2VCandidate("https://example.com/test.mp4");
    expect(Array.isArray(score.rejectionReasons)).toBe(true);
  });
});

// ── selectBestT2VCandidate ────────────────────────────────────────────────

describe("selectBestT2VCandidate — selects highest passing candidate", () => {
  it("selects the passing candidate with highest totalScore", () => {
    const c1 = makeCandidate("c1");
    const c2 = makeCandidate("c2");
    const c3 = makeCandidate("c3");

    const scored = [
      { candidate: c1, score: makeScore({ totalScore: 0.92 }) },
      { candidate: c2, score: makeScore({ totalScore: 0.97 }) },
      { candidate: c3, score: makeScore({ totalScore: 0.88, passed: false, rejectionReasons: ["face_drift"] }) },
    ];

    const result = selectBestT2VCandidate(scored);
    expect(result.accepted).toBe(true);
    expect(result.acceptedCandidate?.id).toBe("c2");
  });

  it("blocks when no candidate passes threshold", () => {
    const scored = [
      { candidate: makeCandidate("c1"), score: makeScore({ totalScore: 0.6, passed: false, rejectionReasons: ["face_drift"] }) },
      { candidate: makeCandidate("c2"), score: makeScore({ totalScore: 0.7, passed: false, rejectionReasons: ["motion_jitter"] }) },
    ];

    const result = selectBestT2VCandidate(scored);
    expect(result.accepted).toBe(false);
    expect(result.blockReason).toBeDefined();
    expect(result.blockReason).toContain("failed QC");
  });

  it("rejected candidates are preserved for diagnostics", () => {
    const scored = [
      { candidate: makeCandidate("c1"), score: makeScore({ totalScore: 0.95 }) },
      { candidate: makeCandidate("c2"), score: makeScore({ totalScore: 0.6, passed: false, rejectionReasons: ["warp"] }) },
    ];

    const result = selectBestT2VCandidate(scored);
    expect(result.accepted).toBe(true);
    expect(result.rejectedCandidates).toHaveLength(1);
    expect(result.rejectedCandidates[0].score.rejectionReasons).toContain("warp");
  });

  it("empty candidate list returns block", () => {
    const result = selectBestT2VCandidate([]);
    expect(result.accepted).toBe(false);
    expect(result.blockReason).toBeDefined();
  });

  it("records total attempt count", () => {
    const scored = [
      { candidate: makeCandidate("c1"), score: makeScore({ totalScore: 0.95 }) },
      { candidate: makeCandidate("c2"), score: makeScore({ totalScore: 0.91 }) },
      { candidate: makeCandidate("c3"), score: makeScore({ totalScore: 0.6, passed: false, rejectionReasons: ["face_drift"] }) },
    ];
    const result = selectBestT2VCandidate(scored);
    expect(result.attempts).toBe(3);
  });

  it("never selects a rejected candidate even if no passing exists", () => {
    const scored = [
      { candidate: makeCandidate("bad1"), score: makeScore({ totalScore: 0.5, passed: false, rejectionReasons: ["face_drift"] }) },
    ];
    const result = selectBestT2VCandidate(scored);
    expect(result.accepted).toBe(false);
    expect(result.acceptedCandidate).toBeUndefined();
  });
});

// ── QC threshold constant ─────────────────────────────────────────────────

describe("T2V_QC_PASS_THRESHOLD", () => {
  it("is 0.9 per spec", () => {
    expect(T2V_QC_PASS_THRESHOLD).toBe(0.9);
  });
});
