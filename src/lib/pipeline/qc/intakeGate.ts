import type { IntakeBrief } from "../../media-realism/types";

export interface IntakeGateResult {
  valid: boolean;
  errors: string[];
}

const VALID_FUNNEL_STAGES = new Set(["awareness", "consideration", "conversion"]);
const VALID_PROOF_TYPES   = new Set(["process-based", "social-proof", "outcome-based"]);

export function validateIntakeBrief(input: Partial<IntakeBrief>): IntakeGateResult {
  const errors: string[] = [];

  // ── Required: targetPlatform ─────────────────────────────────────────────
  if (!input.targetPlatform) {
    errors.push("targetPlatform is required");
  }

  // ── Required: funnelStage (enum) ─────────────────────────────────────────
  if (!input.funnelStage) {
    errors.push("funnelStage is required");
  } else if (!VALID_FUNNEL_STAGES.has(input.funnelStage)) {
    errors.push(`funnelStage must be one of: ${[...VALID_FUNNEL_STAGES].join(", ")}`);
  }

  // ── Required: proofTypeAllowed (enum) ────────────────────────────────────
  if (!input.proofTypeAllowed) {
    errors.push("proofTypeAllowed is required");
  } else if (!VALID_PROOF_TYPES.has(input.proofTypeAllowed)) {
    errors.push(`proofTypeAllowed must be one of: ${[...VALID_PROOF_TYPES].join(", ")}`);
  }

  // ── Required: audienceSegment (min 20 chars) ─────────────────────────────
  if (!input.audienceSegment) {
    errors.push("audienceSegment is required");
  } else if (input.audienceSegment.trim().length < 20) {
    errors.push("audienceSegment must be at least 20 characters");
  }

  // ── Required: campaignObjective (min 10 chars) ───────────────────────────
  if (!input.campaignObjective) {
    errors.push("campaignObjective is required");
  } else if (input.campaignObjective.trim().length < 10) {
    errors.push("campaignObjective must be at least 10 characters");
  }

  // ── Required: brandVoiceStatement (min 30 chars) ────────────────────────
  if (!input.brandVoiceStatement) {
    errors.push("brandVoiceStatement is required");
  } else if (input.brandVoiceStatement.trim().length < 30) {
    errors.push("brandVoiceStatement must be at least 30 characters");
  }

  // ── Required: approvedFacts (min 3 entries) ──────────────────────────────
  if (!input.approvedFacts) {
    errors.push("approvedFacts is required");
  } else if (input.approvedFacts.length < 3) {
    errors.push("approvedFacts must contain at least 3 entries");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
