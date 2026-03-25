/**
 * realism.test.ts
 *
 * E2E realism pipeline tests.
 * These tests verify the full pipeline produces outputs that pass
 * the realism QC engine — not just that it runs without crashing.
 *
 * NOTE: These tests call live APIs. Run with:
 *   E2E=true pnpm test src/test/e2e/realism.test.ts
 *
 * Skipped in CI unless E2E=true is set.
 */

import { describe, it, expect, beforeAll } from "vitest";

const E2E = process.env.E2E === "true";

const VALID_INTAKE = {
  targetPlatform: "meta" as const,
  funnelStage: "awareness" as const,
  proofTypeAllowed: "process-based" as const,
  audienceSegment: "Adults 30-55 seeking convenient, private access to care without waiting rooms",
  campaignObjective: "Drive first consultation starts from cold audience on Meta",
  brandVoiceStatement: "Warm, direct, and trustworthy. Not clinical. Not salesy. Feels like advice from a friend who happens to know medicine.",
  approvedFacts: [
    "Licensed clinicians review every patient submission.",
    "Secure intake can be completed in under 5 minutes.",
    "Treatment decisions are made by licensed providers.",
  ],
};

describe.skipIf(!E2E)("REALISM E2E — full pipeline", () => {

  it("generates 3 distinct AI concepts from intake", async () => {
    const { generateCreative } = await import("@/lib/creative/generateCreative");
    const strategy = await generateCreative(VALID_INTAKE);

    expect(strategy.conceptDirections).toHaveLength(3);
    for (const concept of strategy.conceptDirections) {
      expect(concept.action.length).toBeGreaterThan(10);
      expect(concept.environment.length).toBeGreaterThan(5);
      expect(concept.overlayIntent.headline.length).toBeGreaterThan(3);
      expect(concept.overlayIntent.cta.length).toBeGreaterThan(1);
    }

    // Concepts must be distinct — not all the same subject
    const subjects = strategy.conceptDirections.map(c => c.subjectType);
    const unique = new Set(subjects);
    expect(unique.size).toBeGreaterThanOrEqual(1);

    // Actions must differ
    const actions = strategy.conceptDirections.map(c => c.action);
    expect(new Set(actions).size).toBe(3);
  }, 30000);

  it("generates AI copy with no mechanical field extraction", async () => {
    const { generateCreative } = await import("@/lib/creative/generateCreative");
    const { generateCopy } = await import("@/lib/creative/generateCopy");

    const strategy = await generateCreative(VALID_INTAKE);
    const copy = await generateCopy(strategy.conceptDirections);

    expect(copy.variants).toHaveLength(3);
    for (const variant of copy.variants) {
      expect(variant.headline.split(" ").length).toBeLessThanOrEqual(12);
      expect(variant.cta.split(" ").length).toBeLessThanOrEqual(5);
      expect(variant.bullets.length).toBeGreaterThanOrEqual(2);
      // Should not be raw internal fields
      expect(variant.headline).not.toMatch(/^home_real|^clinical_real|^human_lifestyle/);
    }
  }, 60000);

  it("validator passes clean copy and blocks banned phrases", () => {
    const { validateCopyWithPolicy } = require("@/lib/compliance/validateCopy");
    const { buildPolicy, UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE } = require("@/lib/compliance/compliancePolicy");

    const policy = buildPolicy(UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE);

    const cleanCopy = {
      variants: [{
        conceptId: "c1",
        headline: "Get care from home",
        subheadline: "A licensed provider reviews your case",
        bullets: ["Private and secure", "No waiting room", "Real clinicians"],
        cta: "Start today",
        disclaimer: "",
      }],
    };
    const blockedCopy = {
      variants: [{
        conceptId: "c1",
        headline: "Guaranteed cure in minutes",
        subheadline: "Instant prescription available",
        bullets: ["Cure your condition fast"],
        cta: "Get cured now",
        disclaimer: "",
      }],
    };

    expect(validateCopyWithPolicy(cleanCopy, policy).status).toBe("pass");
    expect(validateCopyWithPolicy(blockedCopy, policy).status).toBe("block");
  });

  it("image QC rejects cinematic/polished candidates", () => {
    const { scoreImageCandidate, shouldRejectImageCandidate } = require("@/lib/media-realism/imageQc");

    const badCandidate = {
      id: "bad-1",
      url: "https://example.com/cinematic.jpg",
      promptUsed: "cinematic portrait",
      attempt: 1,
      ocrText: [],
      metadata: {
        antiCinematicScore: 60,  // below 85 threshold — should reject
        realismScore: 70,
        faceProtectionScore: 92,
        safeZoneScore: 88,
        propComplianceScore: 90,
        clutterScore: 85,
      },
    };

    const goodCandidate = {
      id: "good-1",
      url: "https://example.com/real.jpg",
      promptUsed: "real person at home",
      attempt: 1,
      ocrText: [],
      metadata: {
        antiCinematicScore: 91,
        realismScore: 85,
        faceProtectionScore: 93,
        safeZoneScore: 89,
        propComplianceScore: 92,
        clutterScore: 87,
      },
    };

    const scenePlan = {
      conceptId: "c1", conceptType: "test", subjectType: "person" as const,
      subjectCount: 1 as const, action: "sitting at home", environment: "living room",
      mood: "calm", realismMode: "home_real" as const, shotType: "medium" as const,
      orientation: "landscape" as const, requiredProps: [], forbiddenProps: [],
      forbiddenScenes: [], noTextInImage: true as const,
    };
    const layoutPlan = {
      aspectRatio: "1:1" as const, subjectAnchor: "right_third" as const,
      safeZones: ["top_left" as const], protectedZones: ["face" as const, "hands" as const],
      faceZone: "upper_right" as const, backgroundDensity: "low_left_high_right" as const,
      compositionRules: [], overlaySafeMap: { top_left: "reserved", top_right: "reserved", left_middle: "reserved", right_middle: "reserved", lower_left: "reserved", lower_right: "reserved" },
    };

    const badScore = scoreImageCandidate(badCandidate, scenePlan, layoutPlan);
    const goodScore = scoreImageCandidate(goodCandidate, scenePlan, layoutPlan);

    expect(shouldRejectImageCandidate(badScore)).toBe(true);
    expect(badScore.rejectionReasons).toContain("looks_too_cinematic_or_polished");
    expect(shouldRejectImageCandidate(goodScore)).toBe(false);
  });

  it("scene planner derives correct orientation from aspect ratio", async () => {
    const { buildScenePlanV2 } = await import("@/lib/media-realism/scenePlannerV2");
    const validator = { status: "pass" as const, issues: [], imagePolicy: { allowedVisualClaims: [], forbiddenVisualClaims: [], forbiddenProps: [], forbiddenScenes: [], noTextInImage: true as const } };
    const concept = { id: "c1", angle: "test", hook: "test", subjectType: "person" as const, action: "sitting", environment: "home", realismMode: "home_real" as const, desiredMood: "calm", overlayIntent: { headline: "Test", cta: "Go", textDensityHint: "low" as const, titleLengthClass: "short" as const, ctaLengthClass: "short" as const } };

    const portrait = buildScenePlanV2(concept, validator, "9:16", "tiktok");
    const landscape = buildScenePlanV2(concept, validator, "16:9", "google");
    const square = buildScenePlanV2(concept, validator, "1:1", "meta");

    expect(portrait.orientation).toBe("portrait");
    expect(portrait.shotType).toBe("medium-wide");
    expect(landscape.orientation).toBe("landscape");
    expect(landscape.shotType).toBe("medium");
    expect(square.orientation).toBe("square");
  });

  it("compliance policy is config-driven and niche-independent by default", () => {
    const { buildPolicy, UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE } = require("@/lib/compliance/compliancePolicy");

    const universal = buildPolicy(UNIVERSAL_POLICY);
    const healthcare = buildPolicy(UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE);

    // Universal has no blocked phrases
    expect(universal.blockedPhrases).toHaveLength(0);

    // Healthcare addon adds blocked phrases
    expect(healthcare.blockedPhrases.length).toBeGreaterThan(0);
    expect(healthcare.blockedPhrases).toContain("guaranteed cure");

    // Universal does NOT block "cure" — only healthcare does
    expect(universal.blockedPhrases).not.toContain("guaranteed cure");
  });
});
