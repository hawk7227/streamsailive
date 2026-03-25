import type { IntakeBrief } from "../../media-realism/types";

export interface IntakeGateResult {
  valid: boolean;
  errors: string[];
}

export function validateIntakeBrief(input: Partial<IntakeBrief>): IntakeGateResult {
  const errors: string[] = [];

  if (!input.targetPlatform) errors.push("targetPlatform is required");
  if (!input.funnelStage) errors.push("funnelStage is required");
  if (!input.proofTypeAllowed) errors.push("proofTypeAllowed is required");
  if (!input.audienceSegment || input.audienceSegment.trim().length < 20) errors.push("audienceSegment must be at least 20 characters");
  if (!input.campaignObjective || input.campaignObjective.trim().length < 10) errors.push("campaignObjective must be at least 10 characters");
  if (!input.brandVoiceStatement || input.brandVoiceStatement.trim().length < 30) errors.push("brandVoiceStatement must be at least 30 characters");
  if (!Array.isArray(input.approvedFacts) || input.approvedFacts.length < 3) errors.push("approvedFacts must contain at least 3 items");

  return {
    valid: errors.length === 0,
    errors,
  };
}
