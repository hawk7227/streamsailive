/**
 * src/lib/video-runtime/validateVideoRequest.ts
 *
 * Governance gates — throws VideoRuntimeError on hard input violations.
 * Called before any DB write or provider call.
 */

import type { NormalizedVideoRequest } from "./types";
import { VideoRuntimeError } from "./types";

export function validateVideoRequest(req: NormalizedVideoRequest): void {
  // Image-to-video requires a source image. Do not run the generic prompt
  // structural-integrity compiler gate here: it evaluates prompt structure, not
  // whether a curated provider reference image is usable. Curated/reference
  // image validation belongs in reference intake/QC, and provider output QC runs
  // after generation.
  if (req.mode === "image_to_video" && !req.imageUrl) {
    throw new VideoRuntimeError(
      "MISSING_IMAGE_URL",
      "imageUrl is required for image-to-video generation.",
    );
  }
}
