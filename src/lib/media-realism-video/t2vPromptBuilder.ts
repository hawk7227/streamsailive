/**
 * t2vPromptBuilder.ts
 *
 * Per spec:
 *   sanitizePrompt() — remove cinematic/artistic/dramatic terms
 *   expandPromptWithRealism() — inject realism anchors
 *
 * No niche assumptions. No business logic.
 * The prompt that enters this module may be anything.
 * The prompt that exits is always realism-anchored.
 */

import type { ExpandedPrompt, SanitizeResult, T2VInput, T2VRealismMode } from "./types";

// ── Banned terms (cinematic/stylized/artistic) ─────────────────────────────

const BANNED_TERMS: string[] = [
  "cinematic", "cinematic quality", "cinema",
  "dramatic lighting", "dramatic", "dramatic shadows",
  "film grain", "film look", "filmic",
  "movie still", "movie quality", "movie-like",
  "editorial", "fashion photography", "vogue",
  "studio lighting", "studio light", "studio quality",
  "professional photography", "professional lighting",
  "shallow depth of field", "bokeh", "depth of field",
  "masterpiece", "award-winning", "award winning",
  "8k", "4k ultra hd", "ultra hd", "ultra high definition",
  "hyper detailed", "hyper-detailed", "hyperrealistic",
  "cgi", "cg", "rendered", "render", "3d render",
  "concept art", "art style", "artistic",
  "luxury aesthetic", "luxury", "premium look", "premium quality",
  "glossy", "glossy finish", "polished",
  "soft focus", "dreamy", "ethereal", "surreal",
  "color graded", "color grade", "lut applied",
  "slow motion", "slo-mo",            // unless explicitly requested
  "epic", "stunning", "breathtaking", "mesmerizing",
  "vivid colors", "vibrant colors", "saturated",
  "beautiful", "gorgeous", "perfect", "flawless",
];

// ── Required realism anchors per mode ─────────────────────────────────────

const REALISM_ANCHORS: Record<T2VRealismMode, string[]> = {
  human_lifestyle: [
    "ordinary real-world setting",
    "natural ambient lighting",
    "natural motion",
    "no stylization",
    "candid unposed",
    "believable everyday scene",
  ],
  product_in_use: [
    "ordinary real-world setting",
    "natural ambient lighting",
    "product in natural hands",
    "no stylization",
    "believable use context",
  ],
  environment_only: [
    "real location",
    "ordinary natural lighting",
    "no stylization",
    "believable real-world place",
    "natural ambient light",
  ],
  workspace: [
    "real office or workspace",
    "ordinary fluorescent or window light",
    "no stylization",
    "natural motion",
    "believable work setting",
  ],
};

// ── Negative prompt applied to every T2V request ──────────────────────────

const UNIVERSAL_NEGATIVE =
  "cinematic, dramatic lighting, studio lighting, film look, color grade, " +
  "hyperrealistic render, CGI, concept art, luxury, premium aesthetic, " +
  "bokeh, shallow depth of field, perfect symmetry, polished, glossy, " +
  "AI-generated look, stylized, slow motion, slo-mo, title cards, text overlays, " +
  "watermarks, subtitles, captions, UI elements, interface elements";

// ── sanitizePrompt ─────────────────────────────────────────────────────────

export function sanitizePrompt(rawPrompt: string): SanitizeResult {
  const strippedTerms: string[] = [];
  const warnings: string[] = [];
  let result = rawPrompt;

  for (const term of BANNED_TERMS) {
    const regex = new RegExp(`\\b${term.replace(/[-/]/g, "[-/]?")}\\b`, "gi");
    if (regex.test(result)) {
      strippedTerms.push(term);
      result = result.replace(regex, "").trim();
    }
  }

  // Collapse multiple spaces/commas left behind by removal
  result = result.replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
  result = result.replace(/^[,\s]+|[,\s]+$/g, "").trim();

  if (result.length < 10) {
    warnings.push("Prompt was heavily stripped — using original intent with realism overrides only");
    result = rawPrompt.slice(0, 200); // keep original, realism expansion will override
  }

  if (strippedTerms.length > 3) {
    warnings.push(`Stripped ${strippedTerms.length} cinematic/stylized terms from prompt`);
  }

  return {
    originalPrompt: rawPrompt,
    sanitizedPrompt: result,
    strippedTerms,
    warnings,
  };
}

// ── expandPromptWithRealism ────────────────────────────────────────────────

export function expandPromptWithRealism(
  sanitized: SanitizeResult,
  mode: T2VRealismMode,
): ExpandedPrompt {
  const anchors = REALISM_ANCHORS[mode];

  const finalPrompt = [
    sanitized.sanitizedPrompt,
    anchors.join(", "),
    "If the output looks cinematic, polished, or stylized it is wrong.",
    "If the output looks ordinary, natural, and real it is correct.",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    sanitized,
    finalPrompt,
    negativePrompt: UNIVERSAL_NEGATIVE,
    injectedAnchors: anchors,
  };
}

// ── Entry point ────────────────────────────────────────────────────────────

export function buildT2VPrompt(input: T2VInput): ExpandedPrompt {
  const sanitized = sanitizePrompt(input.prompt);
  return expandPromptWithRealism(sanitized, input.realismMode);
}
