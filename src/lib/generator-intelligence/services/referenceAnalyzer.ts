import type { ReferenceAnalysis } from "../types";

function compact(text?: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function analyzeReferenceSummary(input: {
  referenceSummary?: string | null;
  sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
}): ReferenceAnalysis {
  const summary = compact(input.referenceSummary).toLowerCase();
  const hasReferences = summary.length > 0;
  const mentionsMultiAngle = /(multi-angle|multiple angles|front and side|front, side|front\/side|three angles|5 angles|turntable|profile)/.test(summary);
  const mentionsVideo = /(video|clip|footage|walk cycle|speaking clip|recording)/.test(summary);
  const mentionsSingleStill = /(single image|single still|one image|one photo|single photo|single portrait)/.test(summary);
  const mentionsFaceOnly = /(headshot|portrait|face only|selfie|cropped face)/.test(summary);
  const identitySensitive = input.sourceKind === "self" || input.sourceKind === "family_or_friend" || input.sourceKind === "mixed";

  let referenceStrength: ReferenceAnalysis["referenceStrength"] = "none";
  if (hasReferences) referenceStrength = "low";
  if (hasReferences && (mentionsMultiAngle || mentionsVideo)) referenceStrength = "high";
  else if (hasReferences && !mentionsSingleStill) referenceStrength = "medium";

  const likelyMultiAngle = mentionsMultiAngle || mentionsVideo;
  const likelySingleStill = mentionsSingleStill || (hasReferences && !likelyMultiAngle);

  let anatomyRisk: ReferenceAnalysis["anatomyRisk"] = "low";
  if (!hasReferences || likelySingleStill) anatomyRisk = "high";
  else if (mentionsFaceOnly) anatomyRisk = "medium";

  const warnings: string[] = [];
  const guidance: string[] = [];

  if (!hasReferences) {
    warnings.push("No reference pack supplied. Keep identity expectations loose and motion simple.");
    guidance.push("Prefer synthetic or non-identity-critical scenes unless the user supplies references.");
  }

  if (likelySingleStill) {
    warnings.push("Reference pack looks like a single still. High risk for blob faces, missing hands, and limb drift in video.");
    guidance.push("Reduce motion complexity and avoid turns that reveal hidden body parts.");
  }

  if (mentionsFaceOnly) {
    warnings.push("References appear face-heavy. Full-body motion may guess body proportions incorrectly.");
    guidance.push("Use seated or upper-body scenes unless more body references are added.");
  }

  if (likelyMultiAngle) {
    guidance.push("Multi-angle or clip references detected. Moderate camera movement and small body turns are safer.");
  }

  if (identitySensitive) {
    guidance.push("Lock facial proportions, age cues, and hairstyle continuity across every prompt.");
  }

  return {
    hasReferences,
    referenceStrength,
    likelyMultiAngle,
    likelySingleStill,
    identitySensitive,
    anatomyRisk,
    warnings,
    guidance,
  };
}
