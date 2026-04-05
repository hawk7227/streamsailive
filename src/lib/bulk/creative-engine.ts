import type {
  BulkAspectRatio,
  CreativeAngle,
  CreativeCtaIntent,
  CreativeKind,
  CreativePlan,
  CreativeTone,
} from "./job-schema";
import { pickTemplate } from "./template-engine";
import { scoreTemplateFit } from "./scorer";

const TONES: CreativeTone[] = ["clean", "bold", "minimal", "premium"];
const ANGLES: CreativeAngle[] = ["feature", "benefit", "lifestyle", "conversion"];
const CTAS: CreativeCtaIntent[] = ["shop_now", "learn_more", "limited_offer", "book_now"];
const HEADLINE_TONES: CreativePlan["headlineTone"][] = ["direct", "curious", "premium", "urgent"];

function cycle<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length];
}

export function buildCreativePlan(kind: CreativeKind, aspectRatio: BulkAspectRatio, variantIndex: number): CreativePlan {
  const tone = cycle(TONES, variantIndex);
  const angle = cycle(ANGLES, variantIndex);
  const ctaIntent = cycle(CTAS, variantIndex);
  const template = pickTemplate(kind, aspectRatio, variantIndex);
  const score = scoreTemplateFit(template, tone, angle, ctaIntent);

  return {
    variantIndex,
    kind,
    aspectRatio,
    layoutFamily: template.layoutFamily,
    tone,
    angle,
    ctaIntent,
    headlineTone: cycle(HEADLINE_TONES, variantIndex),
    safeZones: template.safeZones,
    textZones: template.textZones,
    templateId: template.id,
    score,
  };
}

export function buildCreativePrompt(basePrompt: string, plan: CreativePlan): string {
  return [
    basePrompt,
    `Create a ${plan.kind.replaceAll("_", " ")} with ${plan.layoutFamily} layout family.`,
    `Aspect ratio: ${plan.aspectRatio}.`,
    `Tone: ${plan.tone}. Angle: ${plan.angle}. CTA intent: ${plan.ctaIntent}.`,
    `Preserve safe zones for headline, support copy, and CTA.`,
    `Keep composition crop-safe and marketing-ready.`,
    `Do not render visible text; reserve clear space for later editable text overlay.`,
  ].join(" ");
}
