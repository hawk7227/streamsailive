import type { LightingFamily, MediaIntent } from "./types";

export const MEDIA_BOILERPLATE_PREFIXES: RegExp[] = [
  /^generate (an? )?(image|photo|picture|video|clip) of\s+/i,
  /^create (an? )?(image|photo|picture|video|clip) of\s+/i,
  /^make (an? )?(image|photo|picture|video|clip) of\s+/i,
  /^show me (an? )?(image|photo|picture|video|clip) of\s+/i,
  /^generate\s+/i,
  /^create\s+/i,
];

export const MEDIA_LIGHTING_DEFAULTS: Partial<Record<MediaIntent, LightingFamily>> = {
  landscape: "natural daylight",
  portrait: "natural daylight",
  product: "studio soft light",
  food: "natural daylight",
  architecture: "natural daylight",
  macro: "natural daylight",
  concept_art: "night practical light",
  narrative: "natural daylight",
};

// Global negatives applied to every generation — artifact suppression baseline
export const MEDIA_GLOBAL_NEGATIVES: string[] = [
  "no text overlays",
  "no watermark",
  "no logo",
  "no distortion",
  "no unrealistic artifacts",
];

// Base realism stack — global physical plausibility layer
// Applied to all intents. Extended per-intent in selectRealism.
export const MEDIA_BASE_REALISM_STACK: string[] = [
  "near-photorealistic",
  "physically accurate lighting",
  "real-world materials",
  "natural textures",
  "fine detail",
  "no visible AI artifacts",
];
