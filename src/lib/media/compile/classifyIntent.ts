import type { MediaIntent, NormalizedMediaPrompt } from "../types";

const LANDSCAPE_HINTS = [
  "sunset", "sunrise", "ocean", "mountain", "lake", "forest",
  "beach", "desert", "sky", "river", "waterfall", "landscape", "field",
];

export function classifyMediaIntent(
  normalized: NormalizedMediaPrompt,
): { intent: MediaIntent; confidence: number } {
  const { tokens, normalizedPrompt } = normalized;

  if (tokens.graphicTerms.length > 0) return { intent: "graphic", confidence: 0.95 };
  if (tokens.productTerms.length > 0) return { intent: "product", confidence: 0.93 };
  if (tokens.peopleTerms.length > 0) return { intent: "portrait", confidence: 0.92 };
  if (tokens.foodTerms.length > 0) return { intent: "food", confidence: 0.90 };
  if (tokens.architectureTerms.length > 0) return { intent: "architecture", confidence: 0.90 };
  if (tokens.macroTerms.length > 0) return { intent: "macro", confidence: 0.88 };
  if (tokens.illustrationTerms.length > 0) return { intent: "illustration", confidence: 0.90 };
  if (tokens.conceptTerms.length > 0) return { intent: "concept_art", confidence: 0.85 };
  if (tokens.narrativeTerms.length > 0) return { intent: "narrative", confidence: 0.84 };

  if (LANDSCAPE_HINTS.some((term) => normalizedPrompt.includes(term))) {
    return { intent: "landscape", confidence: 0.86 };
  }

  return { intent: "unknown", confidence: 0.40 };
}
