import { TELEHEALTH_GOVERNANCE, TelehealthGovernance } from "./telehealth";
import { GOOGLE_ADS_GOVERNANCE, GoogleAdsGovernance } from "./googleAds";

export { TELEHEALTH_GOVERNANCE, GOOGLE_ADS_GOVERNANCE };
export type { TelehealthGovernance, GoogleAdsGovernance };

// Custom niche row from workspace_niches table
export type CustomNiche = {
  id: string;
  name: string;
  pipeline_type: string;
  brand_tone: string | null;
  approved_facts: string[];
  banned_phrases: string[];
  strategy_prompt: string | null;
  copy_prompt: string | null;
  validator_prompt: string | null;
  image_prompt: string | null;
  image_to_video: string | null;
  qa_instruction: string | null;
  ruleset_version: string;
};

// The canonical governance shape used by the pipeline engine
export type ActiveGovernance = {
  pipelineType: string;
  rulesetVersion: string;
  brandTone: string;
  approvedFacts: string[];
  bannedPhrases: string[];
  complianceLayer: Record<string, boolean>;
  enforcementConfig: {
    fieldLengthEnforcement: Record<string, number>;
    blockTriggers: string[];
    autoFix: { enabled: boolean; maxAttempts: number; allowedFor: string[]; disallowedFor: string[] };
  };
  motionPlanRules: {
    allowedMotions: string[];
    bannedMotions: string[];
    durationDefaults: { minSeconds: number; maxSeconds: number };
  };
  variantRules: { count: number; variantIds: string[]; eachMustHave: string[]; differentiation: string };
  strategyPrompt: string;
  copyPrompt: string;
  validatorPrompt: string;
  imagePrompt: string;
  imageToVideo: string;
  qaInstruction: string;
};

/**
 * loadGovernance(nicheId, customNiches?)
 *
 * Returns the full governance object for a given niche.
 * Built-in niches: "telehealth", "google_ads"
 * Custom niches: matched by id from customNiches array.
 * Custom niches inherit telehealth base and override only supplied fields.
 */
export function loadGovernance(
  nicheId: string,
  customNiches: CustomNiche[] = []
): ActiveGovernance {
  // Built-in niches
  if (nicheId === "telehealth") {
    return governanceToActive(TELEHEALTH_GOVERNANCE);
  }
  if (nicheId === "google_ads") {
    return governanceToActive(GOOGLE_ADS_GOVERNANCE);
  }

  // Custom niche — find by id or pipeline_type
  const custom = customNiches.find(n => n.id === nicheId || n.pipeline_type === nicheId);
  if (!custom) {
    // Fallback to telehealth if niche not found
    console.warn(`[Governance] Niche "${nicheId}" not found — falling back to telehealth`);
    return governanceToActive(TELEHEALTH_GOVERNANCE);
  }

  // Build custom governance by inheriting telehealth base + overriding with custom values
  const base = governanceToActive(TELEHEALTH_GOVERNANCE);
  return {
    ...base,
    pipelineType: custom.pipeline_type,
    rulesetVersion: custom.ruleset_version,
    brandTone: custom.brand_tone ?? base.brandTone,
    approvedFacts: custom.approved_facts.length > 0 ? custom.approved_facts : base.approvedFacts,
    bannedPhrases: custom.banned_phrases.length > 0 ? custom.banned_phrases : base.bannedPhrases,
    strategyPrompt: custom.strategy_prompt ?? base.strategyPrompt,
    copyPrompt: custom.copy_prompt ?? base.copyPrompt,
    validatorPrompt: custom.validator_prompt ?? base.validatorPrompt,
    imagePrompt: custom.image_prompt ?? base.imagePrompt,
    imageToVideo: custom.image_to_video ?? base.imageToVideo,
    qaInstruction: custom.qa_instruction ?? base.qaInstruction,
  };
}

// Normalise a built-in const governance object to ActiveGovernance shape
function governanceToActive(g: typeof TELEHEALTH_GOVERNANCE | typeof GOOGLE_ADS_GOVERNANCE): ActiveGovernance {
  return {
    pipelineType: g.pipelineType,
    rulesetVersion: g.rulesetVersion,
    brandTone: g.brandTone,
    approvedFacts: [...g.approvedFacts],
    bannedPhrases: [...g.bannedPhrases],
    complianceLayer: { ...g.complianceLayer } as Record<string, boolean>,
    enforcementConfig: {
      fieldLengthEnforcement: { ...g.enforcementConfig.fieldLengthEnforcement } as Record<string, number>,
      blockTriggers: [...g.enforcementConfig.blockTriggers],
      autoFix: {
        enabled: g.enforcementConfig.autoFix.enabled,
        maxAttempts: g.enforcementConfig.autoFix.maxAttempts,
        allowedFor: [...g.enforcementConfig.autoFix.allowedFor],
        disallowedFor: [...g.enforcementConfig.autoFix.disallowedFor],
      },
    },
    motionPlanRules: {
      allowedMotions: [...g.motionPlanRules.allowedMotions],
      bannedMotions: [...g.motionPlanRules.bannedMotions],
      durationDefaults: { ...g.motionPlanRules.durationDefaults },
    },
    variantRules: "variantRules" in g
      ? {
          count: g.variantRules.count,
          variantIds: [...g.variantRules.variantIds] as string[],
          eachMustHave: [...g.variantRules.eachMustHave] as string[],
          differentiation: g.variantRules.differentiation,
        }
      : { count: 3, variantIds: ["v1", "v2", "v3"], eachMustHave: [], differentiation: "" },
    strategyPrompt: g.strategyPrompt,
    copyPrompt: g.copyPrompt,
    validatorPrompt: g.validatorPrompt,
    imagePrompt: g.imagePrompt,
    imageToVideo: g.imageToVideo,
    qaInstruction: g.qaInstruction,
  };
}
