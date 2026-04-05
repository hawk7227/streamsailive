import type { CreativeAngle, CreativeCtaIntent, CreativeTone } from "./job-schema";
import type { TemplateDefinition } from "./template-engine";

const toneWeights: Record<CreativeTone, number> = {
  clean: 0.9,
  bold: 0.85,
  minimal: 0.88,
  premium: 0.93,
};

const angleWeights: Record<CreativeAngle, number> = {
  feature: 0.86,
  benefit: 0.9,
  lifestyle: 0.82,
  conversion: 0.94,
};

const ctaWeights: Record<CreativeCtaIntent, number> = {
  shop_now: 0.92,
  learn_more: 0.84,
  limited_offer: 0.9,
  book_now: 0.88,
};

export function scoreTemplateFit(template: TemplateDefinition, tone: CreativeTone, angle: CreativeAngle, cta: CreativeCtaIntent): number {
  const textZoneScore = Math.min(1, template.textZones.length / 3);
  const layoutBias = template.layoutFamily === "hero" ? 0.03 : template.layoutFamily === "comparison" ? 0.05 : 0;
  const raw = toneWeights[tone] * 0.3 + angleWeights[angle] * 0.35 + ctaWeights[cta] * 0.25 + textZoneScore * 0.1 + layoutBias;
  return Number(Math.min(0.99, raw).toFixed(3));
}
