/**
 * realism.test.ts
 *
 * Two sections:
 * 1. UNIT tests — pure logic, run always (no API calls)
 * 2. E2E tests — call live APIs, run only when E2E=true
 *
 * Run unit tests:  pnpm test src/test/e2e/realism.test.ts
 * Run E2E tests:   E2E=true pnpm test src/test/e2e/realism.test.ts
 */

import { describe, it, expect } from "vitest";
import { scoreImageCandidate, shouldRejectImageCandidate } from "@/lib/media-realism/imageQc";
import { buildScenePlanV2 } from "@/lib/media-realism/scenePlannerV2";
import { buildPolicy, UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE, ECOMMERCE_COMPLIANCE } from "@/lib/compliance/compliancePolicy";
import { validateCopyWithPolicy } from "@/lib/compliance/validateCopy";
import type { LayoutPlan, ScenePlan, ValidationResult } from "@/lib/media-realism/types";

const E2E = process.env.E2E === "true";

// ── Shared fixtures ──────────────────────────────────────────────────────────

const MOCK_VALIDATOR: ValidationResult = {
  status: "pass",
  issues: [],
  imagePolicy: {
    allowedVisualClaims: [],
    forbiddenVisualClaims: [],
    forbiddenProps: [],
    forbiddenScenes: [],
    noTextInImage: true,
  },
};

const MOCK_CONCEPT = {
  id: "c1", angle: "test angle", hook: "test",
  subjectType: "person" as const,
  action: "sitting at a kitchen table looking at their phone",
  environment: "lived-in kitchen with dishes in the sink",
  realismMode: "home_real" as const,
  desiredMood: "calm, ordinary",
  overlayIntent: { headline: "Test", cta: "Go", textDensityHint: "low" as const, titleLengthClass: "short" as const, ctaLengthClass: "short" as const },
};

const MOCK_SCENE_PLAN: ScenePlan = {
  conceptId: "c1", conceptType: "test", subjectType: "person",
  subjectCount: 1, action: "sitting at home", environment: "living room",
  mood: "calm", realismMode: "home_real", shotType: "medium",
  orientation: "landscape", requiredProps: [], forbiddenProps: [],
  forbiddenScenes: [], noTextInImage: true,
};

const MOCK_LAYOUT_PLAN: LayoutPlan = {
  aspectRatio: "1:1", subjectAnchor: "right_third",
  safeZones: ["top_left"], protectedZones: ["face", "hands"],
  faceZone: "upper_right", backgroundDensity: "low_left_high_right",
  compositionRules: [],
  overlaySafeMap: { top_left: "r", top_right: "r", left_middle: "r", right_middle: "r", lower_left: "r", lower_right: "r" },
};

// ── UNIT: Compliance policy ──────────────────────────────────────────────────

describe("CompliancePolicy — config-driven, niche-independent", () => {
  it("UNIVERSAL_POLICY has zero blocked phrases", () => {
    expect(UNIVERSAL_POLICY.blockedPhrases).toHaveLength(0);
  });

  it("universal policy passes any copy without blocked phrases", () => {
    const copy = { variants: [{ conceptId: "c1", headline: "Get care from home", subheadline: "A licensed provider reviews your case", bullets: ["Private", "Secure", "Real doctors"], cta: "Start today", disclaimer: "" }] };
    const result = validateCopyWithPolicy(copy, buildPolicy(UNIVERSAL_POLICY));
    expect(result.status).toBe("pass");
    expect(result.issues).toHaveLength(0);
  });

  it("healthcare addon adds blocked phrases not present in universal", () => {
    const universal = buildPolicy(UNIVERSAL_POLICY);
    const healthcare = buildPolicy(UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE);
    expect(universal.blockedPhrases).toHaveLength(0);
    expect(healthcare.blockedPhrases.length).toBeGreaterThan(0);
    expect(healthcare.blockedPhrases).toContain("guaranteed cure");
    expect(healthcare.blockedPhrases).toContain("instant prescription");
  });

  it("healthcare validator blocks banned medical phrases", () => {
    const policy = buildPolicy(UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE);
    const blocked = { variants: [{ conceptId: "c1", headline: "Guaranteed cure for everything", subheadline: "Instant prescription available", bullets: ["cure fast"], cta: "Fix me now", disclaimer: "" }] };
    const result = validateCopyWithPolicy(blocked, policy);
    expect(result.status).toBe("block");
    expect(result.issues.some(i => i.severity === "block")).toBe(true);
  });

  it("ecommerce addon only adds ecommerce phrases", () => {
    const ecommerce = buildPolicy(UNIVERSAL_POLICY, ECOMMERCE_COMPLIANCE);
    expect(ecommerce.blockedPhrases).toContain("guaranteed results");
    expect(ecommerce.blockedPhrases).toContain("miracle");
    expect(ecommerce.blockedPhrases).not.toContain("guaranteed cure");
  });

  it("addons stack correctly", () => {
    const both = buildPolicy(UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE, ECOMMERCE_COMPLIANCE);
    expect(both.blockedPhrases).toContain("guaranteed cure");
    expect(both.blockedPhrases).toContain("miracle");
  });

  it("softFail on headline too long", () => {
    const policy = buildPolicy(UNIVERSAL_POLICY);
    const longHeadline = { variants: [{ conceptId: "c1", headline: "This is a very long headline that definitely exceeds the word limit here", subheadline: "ok", bullets: [], cta: "Go", disclaimer: "" }] };
    const result = validateCopyWithPolicy(longHeadline, policy);
    expect(result.status).toBe("softFail");
    expect(result.issues.some(i => i.code === "headline_too_long")).toBe(true);
  });

  it("softFail does NOT block — pipeline continues", () => {
    const policy = buildPolicy(UNIVERSAL_POLICY);
    const softFail = { variants: [{ conceptId: "c1", headline: "This headline is absolutely definitely way too many words far over the twelve word limit", subheadline: "ok", bullets: [], cta: "Go", disclaimer: "" }] };
    const result = validateCopyWithPolicy(softFail, policy);
    expect(result.status).toBe("softFail");
    expect(result.status).not.toBe("block");
  });

  it("imagePolicy reflects forbidden scenes from policy", () => {
    const policy = buildPolicy(UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE);
    expect(policy.forbiddenScenes).toContain("surgical procedure");
    expect(policy.forbiddenScenes).toContain("medical emergency");
    const vip = buildPolicy(UNIVERSAL_POLICY).forbiddenScenes;
    expect(vip).not.toContain("surgical procedure");
  });
});

// ── UNIT: Image QC scoring ───────────────────────────────────────────────────

describe("ImageQC — rejects cinematic/polished candidates", () => {
  it("rejects candidate with antiCinematicScore below threshold", () => {
    const bad = { id: "bad-1", url: "https://example.com/cinematic.jpg", promptUsed: "test", attempt: 1, ocrText: [], metadata: { antiCinematicScore: 60 } };
    const score = scoreImageCandidate(bad, MOCK_SCENE_PLAN, MOCK_LAYOUT_PLAN);
    expect(shouldRejectImageCandidate(score)).toBe(true);
    expect(score.rejectionReasons).toContain("looks_too_cinematic_or_polished");
  });

  it("rejects candidate with realismScore below threshold", () => {
    const bad = { id: "bad-2", url: "https://example.com/unreal.jpg", promptUsed: "test", attempt: 1, ocrText: [], metadata: { realismScore: 50 } };
    const score = scoreImageCandidate(bad, MOCK_SCENE_PLAN, MOCK_LAYOUT_PLAN);
    expect(shouldRejectImageCandidate(score)).toBe(true);
    expect(score.rejectionReasons).toContain("insufficient_realism");
  });

  it("rejects candidate with text in image", () => {
    const bad = { id: "bad-3", url: "https://example.com/text.jpg", promptUsed: "test", attempt: 1, ocrText: ["BUY NOW", "SALE"], metadata: {} };
    const score = scoreImageCandidate(bad, MOCK_SCENE_PLAN, MOCK_LAYOUT_PLAN);
    expect(shouldRejectImageCandidate(score)).toBe(true);
    expect(score.rejectionReasons).toContain("text_detected_in_image");
    expect(score.antiTextLeakScore).toBe(0);
  });

  it("accepts candidate with all scores above thresholds", () => {
    const good = { id: "good-1", url: "https://example.com/real.jpg", promptUsed: "test", attempt: 1, ocrText: [], metadata: { antiCinematicScore: 92, realismScore: 88, faceProtectionScore: 94, safeZoneScore: 91, propComplianceScore: 93, clutterScore: 88 } };
    const score = scoreImageCandidate(good, MOCK_SCENE_PLAN, MOCK_LAYOUT_PLAN);
    expect(shouldRejectImageCandidate(score)).toBe(false);
    expect(score.rejectionReasons).toHaveLength(0);
  });

  it("totalScore is a weighted combination of dimensions", () => {
    const candidate = { id: "t1", url: "https://example.com/test.jpg", promptUsed: "test", attempt: 1, ocrText: [], metadata: { realismScore: 82, safeZoneScore: 90, faceProtectionScore: 92, propComplianceScore: 92, clutterScore: 85, antiCinematicScore: 90 } };
    const score = scoreImageCandidate(candidate, MOCK_SCENE_PLAN, MOCK_LAYOUT_PLAN);
    expect(score.totalScore).toBeGreaterThan(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
    expect(score.antiTextLeakScore).toBe(100); // no ocrText
  });

  it("face protection failure is an independent rejection reason", () => {
    const bad = { id: "bad-4", url: "https://example.com/noface.jpg", promptUsed: "test", attempt: 1, ocrText: [], metadata: { faceProtectionScore: 60 } };
    const score = scoreImageCandidate(bad, MOCK_SCENE_PLAN, MOCK_LAYOUT_PLAN);
    expect(score.rejectionReasons).toContain("face_not_protected");
  });
});

// ── UNIT: Scene planner V2 — orientation and shot type ───────────────────────

describe("ScenePlannerV2 — orientation and shotType from context", () => {
  it("9:16 → portrait orientation", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "9:16", "tiktok");
    expect(plan.orientation).toBe("portrait");
  });

  it("4:5 → portrait orientation", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "4:5", "instagram");
    expect(plan.orientation).toBe("portrait");
  });

  it("16:9 → landscape orientation", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "16:9", "google");
    expect(plan.orientation).toBe("landscape");
  });

  it("1:1 → square orientation", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "1:1", "meta");
    expect(plan.orientation).toBe("square");
  });

  it("tiktok platform → medium-wide shot", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "9:16", "tiktok");
    expect(plan.shotType).toBe("medium-wide");
  });

  it("instagram platform → medium-wide shot", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "4:5", "instagram");
    expect(plan.shotType).toBe("medium-wide");
  });

  it("google platform → medium shot", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "16:9", "google");
    expect(plan.shotType).toBe("medium");
  });

  it("meta platform → medium shot", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "1:1", "meta");
    expect(plan.shotType).toBe("medium");
  });

  it("inherits forbiddenProps and forbiddenScenes from validator", () => {
    const validator: ValidationResult = { ...MOCK_VALIDATOR, imagePolicy: { ...MOCK_VALIDATOR.imagePolicy, forbiddenProps: ["floating panels"], forbiddenScenes: ["surgery"] } };
    const plan = buildScenePlanV2(MOCK_CONCEPT, validator, "1:1");
    expect(plan.forbiddenProps).toContain("floating panels");
    expect(plan.forbiddenScenes).toContain("surgery");
  });

  it("infers phone as required prop from action text", () => {
    const concept = { ...MOCK_CONCEPT, action: "scrolling through their smartphone while sitting" };
    const plan = buildScenePlanV2(concept, MOCK_VALIDATOR, "1:1");
    expect(plan.requiredProps).toContain("phone");
  });

  it("noTextInImage is always true", () => {
    const plan = buildScenePlanV2(MOCK_CONCEPT, MOCK_VALIDATOR, "1:1");
    expect(plan.noTextInImage).toBe(true);
  });
});

// ── UNIT: Generation config ──────────────────────────────────────────────────

describe("GenerationConfig — env var driven", () => {
  it("defaults to gpt-image-1.5 when IMAGE_MODEL not set", async () => {
    const { generationConfig } = await import("@/lib/media-realism/generationConfig");
    // Upgraded default: gpt-image-1.5. Override via IMAGE_MODEL env var.
    expect(["gpt-image-1.5", process.env.IMAGE_MODEL].filter(Boolean)).toContain(generationConfig.image.model);
  });

  it("defaults to high quality when IMAGE_QUALITY not set", async () => {
    const { generationConfig } = await import("@/lib/media-realism/generationConfig");
    // GPT-image contract: auto | low | medium | high. "standard" is dall-e-3 only.
    expect(["auto", "low", "medium", "high", process.env.IMAGE_QUALITY].filter(Boolean)).toContain(generationConfig.image.quality);
  });

  it("candidate count is a number", async () => {
    const { generationConfig } = await import("@/lib/media-realism/generationConfig");
    expect(typeof generationConfig.image.candidates).toBe("number");
    expect(generationConfig.image.candidates).toBeGreaterThan(0);
  });
});

// ── E2E: Live API tests (E2E=true only) ──────────────────────────────────────

describe.skipIf(!E2E)("E2E — AI creative generation (live API)", () => {
  it("generates 3 distinct concepts from intake", async () => {
    const { generateCreative } = await import("@/lib/creative/generateCreative");
    const strategy = await generateCreative({
      targetPlatform: "meta",
      funnelStage: "awareness",
      proofTypeAllowed: "process-based",
      audienceSegment: "Adults 30-55 seeking convenient, private access to care without waiting rooms",
      campaignObjective: "Drive first consultation starts from cold Meta audience",
      brandVoiceStatement: "Warm, direct, trustworthy. Not clinical. Not salesy. Like advice from a knowledgeable friend.",
      approvedFacts: ["Licensed clinicians review every submission.", "Secure intake under 5 minutes.", "Treatment decisions by licensed providers."],
    });
    expect(strategy.conceptDirections).toHaveLength(3);
    const actions = strategy.conceptDirections.map(c => c.action);
    expect(new Set(actions).size).toBe(3);
    strategy.conceptDirections.forEach(c => {
      expect(c.action.length).toBeGreaterThan(10);
      expect(c.environment.length).toBeGreaterThan(5);
      expect(c.overlayIntent.headline.length).toBeGreaterThan(3);
    });
  }, 30000);

  it("generates real copy per concept", async () => {
    const { generateCreative } = await import("@/lib/creative/generateCreative");
    const { generateCopy } = await import("@/lib/creative/generateCopy");
    const strategy = await generateCreative({
      targetPlatform: "meta",
      funnelStage: "awareness",
      proofTypeAllowed: "process-based",
      audienceSegment: "Adults 30-55 seeking convenient private healthcare access",
      campaignObjective: "Drive first consultation starts",
      brandVoiceStatement: "Warm, direct, human. Not clinical or salesy.",
      approvedFacts: ["Licensed clinicians review submissions.", "Secure intake available.", "Provider-made treatment decisions."],
    });
    const copy = await generateCopy(strategy.conceptDirections);
    expect(copy.variants).toHaveLength(3);
    copy.variants.forEach(v => {
      expect(v.headline.trim().length).toBeGreaterThan(3);
      expect(v.cta.trim().length).toBeGreaterThan(1);
      expect(v.bullets.length).toBeGreaterThanOrEqual(2);
      // Not raw internal field names
      expect(v.headline).not.toMatch(/^home_real|^clinical_real|^workspace_real/);
    });
  }, 60000);
});
