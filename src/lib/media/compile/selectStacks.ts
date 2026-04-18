import { MEDIA_BASE_REALISM_STACK, MEDIA_GLOBAL_NEGATIVES } from "../constants";
import type { MediaIntent, NormalizedMediaPrompt } from "../types";

// ── Stack 1: Realism — global physical plausibility ────────────────────────
// Always applied. Extended per intent. Never collapsed with micro-detail.
export function selectRealismStack(intent: MediaIntent): string[] {
  switch (intent) {
    case "portrait":
      return [
        ...MEDIA_BASE_REALISM_STACK,
        "realistic skin response",
        "natural color separation",
        "plausible facial anatomy",
      ];
    case "product":
      return [
        ...MEDIA_BASE_REALISM_STACK,
        "controlled reflections",
        "edge definition",
        "material realism",
      ];
    case "landscape":
      return [
        ...MEDIA_BASE_REALISM_STACK,
        "physically plausible atmosphere",
        "realistic environmental detail",
        "natural water or terrain behavior",
      ];
    case "food":
      return [
        ...MEDIA_BASE_REALISM_STACK,
        "realistic food textures",
        "natural moisture response",
        "plausible plating environment",
      ];
    case "architecture":
      return [
        ...MEDIA_BASE_REALISM_STACK,
        "accurate spatial proportions",
        "realistic material surface",
        "plausible interior or exterior light",
      ];
    case "macro":
      return [
        ...MEDIA_BASE_REALISM_STACK,
        "extreme physical accuracy at small scale",
        "realistic surface micro-structure",
      ];
    default:
      return [...MEDIA_BASE_REALISM_STACK];
  }
}

// ── Stack 2: Micro-detail — scene-specific fine realism ────────────────────
// Selective. Intent-driven. Never collapsed with realism stack.
export function selectMicroDetailStack(intent: MediaIntent): string[] {
  switch (intent) {
    case "portrait":
      return [
        "natural skin texture",
        "subtle pores",
        "fine facial detail",
        "realistic hair strands",
        "micro facial expressions preserved",
      ];
    case "landscape":
      return [
        "natural water texture",
        "cloud detail",
        "atmospheric gradient",
        "crisp environmental surface detail",
        "light reflection variation",
      ];
    case "product":
      return [
        "surface micro-texture",
        "clean edge detail",
        "realistic material response to light",
        "precise reflection behavior",
      ];
    case "food":
      return [
        "ingredient texture detail",
        "realistic moisture on surfaces",
        "crisp surface detail",
      ];
    case "architecture":
      return [
        "material grain detail",
        "surface texture realism",
        "clean edge transitions",
      ];
    case "macro":
      return [
        "extreme surface detail",
        "micro texture clarity",
        "fine material variation",
      ];
    default:
      return [];
  }
}

// ── Stack 3: Negative bank — artifact suppression ──────────────────────────
// Additive constraint set. Never collapsed with realism or micro-detail.
export function selectNegativeBank(
  intent: MediaIntent,
  normalized: NormalizedMediaPrompt,
): string[] {
  const negatives = new Set<string>([
    ...MEDIA_GLOBAL_NEGATIVES,
    ...normalized.tokens.explicitNegatives,
  ]);

  if (intent === "portrait") {
    negatives.add("no facial distortion");
    negatives.add("no extra limbs");
    negatives.add("no identity drift");
    negatives.add("no plastic skin");
    negatives.add("no oversmoothed skin");
  }

  if (intent === "landscape") {
    negatives.add("no unwanted people");
    negatives.add("no random foreground objects");
    negatives.add("no foreground clutter");
  }

  if (intent === "product") {
    negatives.add("no object duplication");
    negatives.add("no warped geometry");
    negatives.add("no material inconsistency");
  }

  if (intent === "food") {
    negatives.add("no artificial sheen");
    negatives.add("no plastic-looking surfaces");
  }

  if (intent === "macro") {
    negatives.add("no depth of field inconsistency");
    negatives.add("no scale distortion");
  }

  return Array.from(negatives);
}
