import type { MediaIntent } from "../media/types";
import type { ImageSceneClass, ImageSize, ImageShotSize } from "./types";

export const IMAGE_SCENE_CLASS_MAP: Record<MediaIntent, ImageSceneClass> = {
  landscape: "wide landscape photograph",
  portrait: "environmental portrait photograph",
  product: "studio product photograph",
  food: "food editorial photograph",
  architecture: "architectural/interior photograph",
  macro: "macro/detail photograph",
  graphic: "flat graphic image",
  illustration: "stylized illustration",
  concept_art: "cinematic concept image",
  narrative: "realistic photograph",
  unknown: "realistic photograph",
};

export const IMAGE_SHOT_MAP: Record<MediaIntent, ImageShotSize> = {
  landscape: "wide shot",
  portrait: "medium close-up",
  product: "product hero shot",
  food: "medium shot",
  architecture: "wide shot",
  macro: "detail shot",
  graphic: "wide shot",
  illustration: "wide shot",
  concept_art: "wide shot",
  narrative: "medium shot",
  unknown: "medium shot",
};

export const IMAGE_ASPECT_RATIO_TO_SIZE: Record<string, ImageSize> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5": "1024x1536",
};

export const IMAGE_DEFAULT_MODEL = "gpt-image-1";
export const IMAGE_DEFAULT_QUALITY = "medium" satisfies "low" | "medium" | "high";
export const IMAGE_DEFAULT_FORMAT = "png" satisfies "png" | "jpeg" | "webp";

// Image-specific global negatives — added on top of shared MEDIA_GLOBAL_NEGATIVES
export const IMAGE_EXTRA_NEGATIVES: string[] = [
  "no cgi look",
  "no stock photo staging",
  "no oversharpening",
  "no artificial reflections",
];
