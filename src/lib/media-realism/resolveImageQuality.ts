/**
 * src/lib/media-realism/resolveImageQuality.ts
 *
 * Type guard and quality resolver for GPT-image models.
 *
 * PURPOSE
 * ───────
 * Prevents raw env values from reaching the OpenAI provider directly.
 * The quality contract for gpt-image-1 and gpt-image-1.5 is:
 *   "auto" | "low" | "medium" | "high"
 * "standard" and "hd" are dall-e-3 values — passing them to gpt-image-1.x
 * causes a provider 400 and silent image generation failure.
 *
 * USAGE
 * ─────
 * Called in generationClient.ts before the OpenAI fetch.
 * Never pass generationConfig.image.quality directly to the provider
 * without running it through resolveImageQuality first.
 */

export type GPTImageModel =
  | "gpt-image-1"
  | "gpt-image-1.5";

export type GPTImageQuality = "auto" | "low" | "medium" | "high";

const VALID_QUALITIES = new Set<string>(["auto", "low", "medium", "high"]);

export function isGPTImageModel(model: string): model is GPTImageModel {
  return model === "gpt-image-1" || model === "gpt-image-1.5";
}

/**
 * Resolves quality to a value valid for GPT-image models.
 * Falls back to `fallback` when the configured value is outside the contract.
 *
 * @param _model   — reserved for per-model quality logic if needed in future
 * @param quality  — configured quality value (from env or generationConfig)
 * @param fallback — safe default when quality is invalid ("medium" recommended)
 */
export function resolveImageQuality(
  _model: string,
  quality: string | undefined,
  fallback: GPTImageQuality,
): GPTImageQuality {
  if (quality && VALID_QUALITIES.has(quality)) {
    return quality as GPTImageQuality;
  }
  return fallback;
}
