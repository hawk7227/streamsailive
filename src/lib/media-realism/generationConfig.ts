import { IMAGE_CANDIDATES, IMAGE_MAX_ATTEMPTS, IMAGE_MODEL, IMAGE_QUALITY, VIDEO_MAX_SECONDS, VIDEO_PROVIDER } from "@/lib/env";
/**
 * generationConfig.ts
 *
 * All provider settings driven by environment variables.
 * No hardcoded model, quality, or candidate count.
 */

export const generationConfig = {
  image: {
    model: IMAGE_MODEL ?? "gpt-image-1",
    quality: (IMAGE_QUALITY ?? "medium") as "standard" | "hd" | "low" | "medium" | "high",
    candidates: Number(IMAGE_CANDIDATES ?? "4"),
    maxAttempts: Number(IMAGE_MAX_ATTEMPTS ?? "3"),
  },
  video: {
    maxDurationSeconds: Number(VIDEO_MAX_SECONDS ?? "5"),
    provider: VIDEO_PROVIDER ?? "kling",
  },
} as const;


