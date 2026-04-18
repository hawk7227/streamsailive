// ── Shared media compiler types ───────────────────────────────────────────
// Used by both src/lib/image/ and src/lib/video/ compilers.
// Do not collapse realismStack / microDetailStack / negativeBank —
// they are distinct layers with different purposes.

export type MediaIntent =
  | "landscape"
  | "portrait"
  | "product"
  | "food"
  | "architecture"
  | "macro"
  | "graphic"
  | "illustration"
  | "concept_art"
  | "narrative"
  | "unknown";

export type ShotSize =
  | "establishing wide shot"
  | "wide shot"
  | "medium shot"
  | "medium close-up"
  | "close-up"
  | "detail shot"
  | "product hero shot";

export type DepthLogic =
  | "deep focus"
  | "shallow depth of field"
  | "moderate depth of field"
  | "controlled selective focus"
  | "narrow focal plane"
  | "not_applicable";

export type LightingFamily =
  | "natural daylight"
  | "golden hour natural light"
  | "overcast daylight"
  | "studio soft light"
  | "hard directional light"
  | "night practical light";

export type CameraLogic = {
  lens: string;
  viewpoint: string;
  notes: string[];
};

export type FramingLogic = {
  compositionRules: string[];
  subjectRules: string[];
  environmentRules: string[];
};

export type PromptTokens = {
  subjects: string[];
  peopleTerms: string[];
  productTerms: string[];
  foodTerms: string[];
  architectureTerms: string[];
  macroTerms: string[];
  graphicTerms: string[];
  illustrationTerms: string[];
  conceptTerms: string[];
  narrativeTerms: string[];
  styleTerms: string[];
  cameraTerms: string[];
  lightingTerms: string[];
  motionTerms: string[];
  audioTerms: string[];
  explicitNegatives: string[];
};

export type NormalizedMediaPrompt = {
  rawPrompt: string;
  subjectPrompt: string;
  normalizedPrompt: string;
  tokens: PromptTokens;
};

// ── Three stacks — must remain separate ───────────────────────────────────
// realismStack    → global physical plausibility (always applied)
// microDetailStack→ scene-specific fine detail (intent-driven, selective)
// negativeBank    → artifact suppression (additive constraint set)

export type MediaStacks = {
  realismStack: string[];
  microDetailStack: string[];
  negativeBank: string[];
};
