/**
 * src/lib/video-runtime/validateVideoRequest.ts
 *
 * Governance gates — throws VideoRuntimeError on any violation.
 * Called before any DB write or provider call.
 * Parity with /api/generations governance gates.
 */

import { compileGenerationRequest } from "@/lib/generator-intelligence/compiler";
import type { NormalizedVideoRequest } from "./types";
import { VideoRuntimeError } from "./types";

function isTrustedReferencePresetUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return (
    url.includes("/reference-presets/video-generation/provider/") ||
    url.includes("/public/reference-presets/video-generation/provider/")
  );
}

export function validateVideoRequest(req: NormalizedVideoRequest): void {
  // i2v requires a source image
  if (req.mode === "image_to_video" && !req.imageUrl) {
    throw new VideoRuntimeError(
      "MISSING_IMAGE_URL",
      "imageUrl is required for image-to-video generation.",
    );
  }

  // Trusted library presets are curated provider-ready source images.
  // Do not block them with the generic prompt structural gate that is designed
  // for unsafe/random user source images.
  if (req.mode === "image_to_video" && isTrustedReferencePresetUrl(req.imageUrl)) {
    return;
  }

  // i2v: run structural score gate — block unsafe source images
  if (req.mode === "image_to_video" && req.imageUrl) {
    const compiled = compileGenerationRequest({
      medium: "video",
      prompt: req.prompt,
      provider: req.provider,
      storyBible: req.storyBible,
    });

    if (
      compiled.structuralScore &&
      !compiled.structuralScore.isSafeForVideo
    ) {
      throw new VideoRuntimeError(
        "STRUCTURAL_SCORE_BLOCKED",
        "Source image is not safe for video yet. Structural integrity score is too low.",
        {
          structuralScore: compiled.structuralScore,
          repairPlan: compiled.repairPlan,
        },
      );
    }
  }
}
