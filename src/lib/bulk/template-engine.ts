import type { BulkAspectRatio, CreativeKind, CreativeLayoutFamily, SafeZone, TextZone } from "./job-schema";

export interface TemplateDefinition {
  id: string;
  kind: CreativeKind;
  name: string;
  layoutFamily: CreativeLayoutFamily;
  supportedAspects: BulkAspectRatio[];
  safeZones: SafeZone[];
  textZones: TextZone[];
  guidance: string;
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "ad-hero",
    kind: "ad",
    name: "Ad Hero",
    layoutFamily: "hero",
    supportedAspects: ["1:1", "4:5", "9:16", "16:9"],
    safeZones: [{ x: 0.08, y: 0.08, width: 0.84, height: 0.84 }],
    textZones: [
      { role: "headline", x: 0.08, y: 0.08, width: 0.52, height: 0.16 },
      { role: "subheadline", x: 0.08, y: 0.25, width: 0.48, height: 0.12 },
      { role: "cta", x: 0.08, y: 0.78, width: 0.26, height: 0.08 },
    ],
    guidance: "Hero-first layout with clean headline block and CTA pinned in a lower-safe area.",
  },
  {
    id: "banner-split",
    kind: "banner",
    name: "Banner Split",
    layoutFamily: "split",
    supportedAspects: ["16:9", "1:1", "4:5"],
    safeZones: [{ x: 0.05, y: 0.12, width: 0.42, height: 0.76 }, { x: 0.52, y: 0.12, width: 0.43, height: 0.76 }],
    textZones: [
      { role: "headline", x: 0.06, y: 0.16, width: 0.34, height: 0.16 },
      { role: "subheadline", x: 0.06, y: 0.34, width: 0.36, height: 0.11 },
      { role: "cta", x: 0.06, y: 0.72, width: 0.18, height: 0.08 },
    ],
    guidance: "Split composition with text on one side and product scene on the other.",
  },
  {
    id: "seo-stacked",
    kind: "seo_image",
    name: "SEO Stacked",
    layoutFamily: "stacked",
    supportedAspects: ["16:9", "1:1"],
    safeZones: [{ x: 0.08, y: 0.10, width: 0.84, height: 0.80 }],
    textZones: [
      { role: "headline", x: 0.08, y: 0.10, width: 0.70, height: 0.15 },
      { role: "subheadline", x: 0.08, y: 0.28, width: 0.64, height: 0.10 },
      { role: "badge", x: 0.08, y: 0.72, width: 0.24, height: 0.08 },
    ],
    guidance: "SEO-friendly composition with generous top headline space and stacked product support.",
  },
  {
    id: "landing-comparison",
    kind: "comparison_graphic",
    name: "Landing Comparison",
    layoutFamily: "comparison",
    supportedAspects: ["16:9", "4:5"],
    safeZones: [{ x: 0.06, y: 0.10, width: 0.88, height: 0.80 }],
    textZones: [
      { role: "headline", x: 0.08, y: 0.08, width: 0.56, height: 0.12 },
      { role: "subheadline", x: 0.08, y: 0.22, width: 0.54, height: 0.10 },
      { role: "cta", x: 0.72, y: 0.78, width: 0.18, height: 0.08 },
    ],
    guidance: "Comparison template for before-versus-after or feature-versus-feature messaging.",
  },
  {
    id: "collection-grid",
    kind: "promo_block",
    name: "Collection Grid",
    layoutFamily: "collection",
    supportedAspects: ["1:1", "4:5"],
    safeZones: [{ x: 0.07, y: 0.08, width: 0.86, height: 0.84 }],
    textZones: [
      { role: "headline", x: 0.08, y: 0.08, width: 0.54, height: 0.14 },
      { role: "price", x: 0.08, y: 0.72, width: 0.18, height: 0.08 },
      { role: "cta", x: 0.70, y: 0.80, width: 0.18, height: 0.08 },
    ],
    guidance: "Collection style block with product grouping and conversion CTA.",
  },
];

export function listTemplates(): TemplateDefinition[] {
  return TEMPLATES;
}

export function pickTemplate(kind: CreativeKind, aspectRatio: BulkAspectRatio, variantIndex: number): TemplateDefinition {
  const matches = TEMPLATES.filter((template) => template.kind === kind && template.supportedAspects.includes(aspectRatio));
  const pool = matches.length > 0 ? matches : TEMPLATES.filter((template) => template.supportedAspects.includes(aspectRatio));
  return pool[variantIndex % pool.length];
}
