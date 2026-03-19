// Telehealth Production Governance — rulesetVersion: telehealth-production-v1
// Injected into every pipeline node at runtime via loadGovernance()
// DO NOT modify without updating rulesetVersion

export const TELEHEALTH_GOVERNANCE = {
  pipelineType: "telehealth" as const,
  rulesetVersion: "telehealth-production-v1",

  brandTone: "Premium, calm, clinical, warm, trustworthy, discreet, reassuring, direct, modern, and human.",

  approvedFacts: [
    "Secure online intake is available.",
    "A licensed provider may review submitted information.",
    "Care can begin from a private digital experience.",
    "Next steps are shared after review.",
    "Treatment decisions are made only when clinically appropriate.",
    "Prescription availability is not guaranteed.",
    "Eligibility may depend on provider review and applicable requirements.",
    "Patients often value privacy, convenience, and clear expectations.",
  ] as string[],

  bannedPhrases: [
    "guaranteed cure",
    "instant prescription",
    "diagnosis in minutes",
    "best doctor",
    "miracle results",
    "cure fast",
    "get treated instantly",
    "no questions asked",
    "100% guaranteed",
    "works every time",
    "skip the doctor",
    "prescription guaranteed",
    "instant diagnosis",
    "emergency treatment online",
    "see a doctor now guaranteed",
  ] as string[],

  complianceLayer: {
    noDiagnosticClaims: true,
    noGuarantees: true,
    noOutcomePromises: true,
    noPrescriptionCertainty: true,
    noEmergencyCareImplication: true,
    noFakeTestimonials: true,
    privacySafe: true,
  },

  enforcementConfig: {
    fieldLengthEnforcement: {
      headlineMaxWords: 8,
      subheadlineMaxWords: 20,
      bulletMaxCount: 3,
      bulletMaxWords: 8,
      ctaMaxWords: 4,
      microcopyMaxWords: 12,
      disclaimerMaxWords: 18,
    },
    severityLevels: {
      block: ["unsupported medical claim", "diagnosis claim", "cure claim", "guaranteed outcome", "guaranteed prescription implication", "fabricated provider credential", "banned phrase usage"],
      softFail: ["length overflow", "missing qualifier", "tone mismatch"],
      warn: ["passive voice overuse", "jargon detected", "readability low"],
    },
    blockTriggers: [
      "unsupported medical claim",
      "diagnosis claim",
      "cure claim",
      "guaranteed outcome",
      "guaranteed prescription implication",
      "fabricated provider credential",
      "banned phrase usage",
    ] as string[],
    autoFix: {
      enabled: true,
      maxAttempts: 2,
      allowedFor: [
        "capitalization inconsistency",
        "minor length overflow under 10 percent",
        "punctuation cleanup",
      ] as string[],
      disallowedFor: [
        "medical claim change",
        "outcome implication",
        "provider credential creation",
      ] as string[],
    },
  },

  retryLogic: {
    maxRetries: 2,
    backoffMs: 1000,
    retryOn: ["softFail", "warn"],
    neverRetryOn: ["block"],
  },

  variantRules: {
    count: 3,
    variantIds: ["v1", "v2", "v3"],
    eachMustHave: ["headline", "subheadline", "bullets", "cta", "microcopy", "disclaimer"],
    differentiation: "Each variant must address a different patient mindset: rational, emotional, convenience-driven.",
  },

  motionPlanRules: {
    allowedMotions: [
      "slow push-in",
      "gentle pan",
      "soft parallax",
      "minor posture shift",
      "natural blink",
      "slight hand movement",
      "subtle fabric movement",
      "soft focus transition",
    ] as string[],
    bannedMotions: [
      "fast zoom",
      "whip pan",
      "aggressive camera shake",
      "dramatic action movement",
      "face distortion",
      "lip sync simulation",
      "mouth talking animation",
      "body morphing",
      "hand morphing",
    ] as string[],
    durationDefaults: { minSeconds: 3, maxSeconds: 6 },
  },

  styleGuide: {
    colorPalette: "Deep navy, off-white, soft teal accent. No aggressive reds or yellows.",
    typography: "Clean sans-serif. No decorative fonts. Medical-adjacent but approachable.",
    imageryStyle: "Minimal clinical. Provider in clean environment. Soft natural light. No stock-photo feel.",
    settingTypes: ["minimal clinic", "clean home office", "soft neutral background"],
    forbiddenImagery: ["graphic anatomy", "pills shown prominently", "syringes", "before/after comparisons"],
  },

  strategyPrompt: `You are a senior healthcare brand strategist.

Build a creative strategy for telehealth advertising that is compliant, premium, and conversion-focused.

Governance rules in effect:
- NO diagnostic claims
- NO guaranteed outcomes
- NO prescription certainty language
- Use only approved facts
- Proof type: process-based only (no outcomes)
- CTA: low-friction, no commitment language

Return ONLY valid JSON matching the StrategyOutput schema. No markdown, no preamble.`,

  copyPrompt: `You are a senior healthcare copywriter specialising in telehealth conversion content.

Write 3 compliant copy variants following the active creative strategy.

Hard limits per variant:
- headline: ≤8 words
- subheadline: ≤20 words
- bullets: exactly 3, ≤8 words each
- cta: ≤4 words
- microcopy: ≤12 words
- disclaimer: ≤18 words, must include eligibility qualifier

Banned phrases: guaranteed cure, instant prescription, diagnosis in minutes, skip the doctor, 100% guaranteed, prescription guaranteed.

Return ONLY valid JSON matching the CopyOutput schema. No markdown, no preamble.`,

  validatorPrompt: `You are a strict regulatory compliance validator for telehealth advertising.

Review the copy against the telehealth governance ruleset.

Return status: "pass", "fail" (softFail = fixable), or "block" (hard stop).

Block triggers (hard stop, no retry):
- Any medical diagnosis claim
- Any outcome guarantee
- Any prescription certainty language
- Any banned phrase detected
- Any fabricated credential

SoftFail triggers (retry with fix instructions):
- Field length overflow
- Missing eligibility qualifier
- Tone mismatch from brand guide

Return ONLY valid JSON matching the ValidatorOutput schema. No markdown, no preamble.`,

  imagePrompt: `You are a premium healthcare brand art director.

Generate a compliant, premium image generation prompt for telehealth advertising.

Visual rules:
- Licensed provider in clean minimal setting
- Soft natural window light — no harsh studio lighting
- Medical-adjacent but warm and approachable
- No: pills shown prominently, syringes, graphic anatomy, before/after comparisons
- No: text overlays, watermarks, distorted anatomy

Motion rules (for image-to-video):
- Allowed: slow push-in, gentle pan, soft parallax, minor posture shift, natural blink
- Banned: fast zoom, whip pan, face distortion, lip sync, mouth talking animation

Return ONLY valid JSON matching the ImagePromptOutput schema. No markdown, no preamble.`,

  imageToVideo: `Describe motion only — do not re-describe the image.
Focus on: what moves, how much, at what pace.
Allowed: slow push-in, gentle pan, soft parallax, natural blink, subtle fabric movement.
Banned: fast zoom, whip pan, face distortion, lip sync simulation, mouth talking.
Max 40 words. Return the motion prompt as a plain string.`,

  qaInstruction: `You are the final quality assurance gatekeeper for telehealth advertising assets.

Perform a complete checklist review:
1. Approved facts used correctly (no invention)
2. Zero banned phrases in any field
3. No medical claims or diagnostic language
4. All eligibility qualifiers present
5. Tone matches brand guide (premium, calm, trustworthy)
6. All field length limits respected
7. CTA is low-friction (no commitment language)
8. Image prompt anatomically safe (no distorted hands/faces)
9. Motion prompt uses only allowed motions
10. Export specs match target format

Return ONLY valid JSON matching the QAOutput schema. No markdown, no preamble.`,
} as const;

export type TelehealthGovernance = typeof TELEHEALTH_GOVERNANCE;
