/**
 * src/lib/video-runtime/resolveVideoProvider.ts
 *
 * Maps raw provider/model input to a canonical { provider, model } pair.
 * Owns provider routing for video. No generation logic here.
 * Pure function.
 */

import type { NormalizedVideoRequest } from "./types";

const FAL_VIDEO_MODELS = new Set(["kling-v3", "veo-3.1"]);
const DEFAULT_PROVIDER = "fal";
const DEFAULT_MODEL = "kling-v3";

export function resolveVideoProvider(req: NormalizedVideoRequest): {
  provider: string;
  model: string;
} {
  // Explicit model overrides provider
  const requestedModel = req.model?.trim() ?? "";
  if (FAL_VIDEO_MODELS.has(requestedModel)) {
    return { provider: "fal", model: requestedModel };
  }

  const requestedProvider = req.provider?.trim().toLowerCase() ?? "";

  if (requestedProvider === "runway") {
    return { provider: "runway", model: req.model || "gen4_turbo" };
  }

  if (requestedProvider === "kling") {
    return { provider: "kling", model: req.model || "kling-v2-6" };
  }

  if (requestedProvider === "fal") {
    return { provider: "fal", model: req.model || DEFAULT_MODEL };
  }

  // Default
  return { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL };
}
