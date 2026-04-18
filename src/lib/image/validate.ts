// ── Image compiler boundary validator ─────────────────────────────────────
// Validates CompileImagePromptOptions at runtime.
// TypeScript union types are compile-time only — this enforces them at runtime,
// guarding against values that arrive from AI tool calls or API boundaries.

import type { CompileImagePromptOptions, ImageAspectRatio, ImageOutputFormat, ImageQuality } from "./types";
import type { MediaIntent } from "../media/types";

const VALID_INTENTS = new Set<MediaIntent>([
  "landscape", "portrait", "product", "food", "architecture",
  "macro", "graphic", "illustration", "concept_art", "narrative", "unknown",
]);

const VALID_ASPECT_RATIOS = new Set<ImageAspectRatio>(["1:1", "16:9", "9:16", "4:5"]);
const VALID_QUALITIES = new Set<ImageQuality>(["low", "medium", "high"]);
const VALID_FORMATS = new Set<ImageOutputFormat>(["png", "jpeg", "webp"]);

export function validateCompileOptions(raw: unknown): CompileImagePromptOptions {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("CompileImagePromptOptions must be an object.");
  }

  const opts = raw as Record<string, unknown>;
  const result: CompileImagePromptOptions = {};

  if ("forceIntent" in opts && opts.forceIntent !== undefined) {
    if (!VALID_INTENTS.has(opts.forceIntent as MediaIntent)) {
      throw new Error(`Invalid forceIntent: "${opts.forceIntent}". Must be one of: ${[...VALID_INTENTS].join(", ")}`);
    }
    result.forceIntent = opts.forceIntent as MediaIntent;
  }

  if ("aspectRatio" in opts && opts.aspectRatio !== undefined) {
    if (!VALID_ASPECT_RATIOS.has(opts.aspectRatio as ImageAspectRatio)) {
      throw new Error(`Invalid aspectRatio: "${opts.aspectRatio}". Must be one of: ${[...VALID_ASPECT_RATIOS].join(", ")}`);
    }
    result.aspectRatio = opts.aspectRatio as ImageAspectRatio;
  }

  if ("quality" in opts && opts.quality !== undefined) {
    if (!VALID_QUALITIES.has(opts.quality as ImageQuality)) {
      throw new Error(`Invalid quality: "${opts.quality}". Must be one of: ${[...VALID_QUALITIES].join(", ")}`);
    }
    result.quality = opts.quality as ImageQuality;
  }

  if ("outputFormat" in opts && opts.outputFormat !== undefined) {
    if (!VALID_FORMATS.has(opts.outputFormat as ImageOutputFormat)) {
      throw new Error(`Invalid outputFormat: "${opts.outputFormat}". Must be one of: ${[...VALID_FORMATS].join(", ")}`);
    }
    result.outputFormat = opts.outputFormat as ImageOutputFormat;
  }

  return result;
}
