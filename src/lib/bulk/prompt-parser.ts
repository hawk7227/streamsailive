import type { BulkAspectRatio, CreativeKind } from "./job-schema";

export interface ParsedBulkPrompt {
  requestedCount: number;
  requestedSize: string;
  aspects: BulkAspectRatio[];
  kinds: CreativeKind[];
  sourceType: "prompt" | "document";
  basePrompt: string;
}

const KIND_KEYWORDS: Array<{ kind: CreativeKind; words: string[] }> = [
  { kind: "ad", words: ["ad", "ads", "creative"] },
  { kind: "banner", words: ["banner", "hero banner"] },
  { kind: "landing_visual", words: ["landing", "landing visual", "hero section"] },
  { kind: "seo_image", words: ["seo", "blog image"] },
  { kind: "email_graphic", words: ["email", "newsletter"] },
  { kind: "comparison_graphic", words: ["comparison", "versus", "vs"] },
  { kind: "promo_block", words: ["promo", "offer", "promotion"] },
  { kind: "product_image", words: ["product image", "product shot"] },
  { kind: "lifestyle", words: ["lifestyle"] },
];

function parseAspects(text: string): BulkAspectRatio[] {
  const lower = text.toLowerCase();
  const aspects = new Set<BulkAspectRatio>();
  if (lower.includes("1:1")) aspects.add("1:1");
  if (lower.includes("4:5")) aspects.add("4:5");
  if (lower.includes("9:16")) aspects.add("9:16");
  if (lower.includes("16:9")) aspects.add("16:9");
  return aspects.size > 0 ? [...aspects] : ["1:1"];
}

function parseKinds(text: string): CreativeKind[] {
  const lower = text.toLowerCase();
  const matches = KIND_KEYWORDS.filter(({ words }) => words.some((word) => lower.includes(word))).map(({ kind }) => kind);
  return matches.length > 0 ? [...new Set(matches)] : ["ad"];
}

export function parseBulkPrompt(input: string): ParsedBulkPrompt {
  const normalized = input.replace(/\s+/g, " ").trim();
  const countMatch = normalized.match(/(\d+)\s*(images|variants|creatives|outputs)/i) ?? normalized.match(/generate\s+(\d+)/i);
  const requestedCount = countMatch ? Math.max(1, Math.min(20, Number.parseInt(countMatch[1], 10))) : 4;
  const sizeMatch = normalized.match(/(\d{3,4}x\d{3,4})/i);
  const requestedSize = sizeMatch ? sizeMatch[1] : "1024x1024";
  return {
    requestedCount,
    requestedSize,
    aspects: parseAspects(normalized),
    kinds: parseKinds(normalized),
    sourceType: /(^#|\n#|\*\*|^-\s|\d+\.)/m.test(input) ? "document" : "prompt",
    basePrompt: normalized,
  };
}
