/**
 * src/lib/video-runtime/normalizeVideoRequest.ts
 *
 * Converts raw GenerateVideoInput into a clean NormalizedVideoRequest.
 * Pure function — no side effects, no DB, no provider calls.
 */

import type { GenerateVideoInput, NormalizedVideoRequest, VideoMode } from "./types";

const DEFAULT_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 30;
const MIN_DURATION_SECONDS = 3;
const DEFAULT_PROVIDER = "fal";

function parseDurationSeconds(value?: string): number {
  if (!value) return DEFAULT_DURATION_SECONDS;
  const match = value.match(/\d+/);
  if (!match) return DEFAULT_DURATION_SECONDS;
  const n = Number(match[0]);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DURATION_SECONDS;
  return Math.min(Math.max(n, MIN_DURATION_SECONDS), MAX_DURATION_SECONDS);
}

function resolveMode(input: GenerateVideoInput): VideoMode {
  if (input.type === "i2v") return "image_to_video";
  if (input.longVideo === true || input.storyBible?.trim()) return "story_to_video";
  return "text_to_video";
}

function resolveAspectRatio(
  value?: string,
): "16:9" | "9:16" | "1:1" {
  if (value === "9:16" || value === "1:1") return value;
  return "16:9";
}

function resolveQuality(value?: string): "standard" | "high" {
  const v = value?.toLowerCase() ?? "";
  if (v.includes("4k") || v.includes("high")) return "high";
  return "standard";
}

function resolveRealismMode(
  value?: string,
): "strict_everyday" | "premium_commercial" {
  return value === "premium_commercial" ? "premium_commercial" : "strict_everyday";
}

export function normalizeVideoRequest(
  input: GenerateVideoInput,
): NormalizedVideoRequest {
  return {
    mode: resolveMode(input),
    prompt: input.prompt.trim(),
    storyBible: input.storyBible?.trim() || undefined,
    imageUrl: input.imageUrl?.trim() || undefined,
    durationSeconds: parseDurationSeconds(input.duration),
    aspectRatio: resolveAspectRatio(input.aspectRatio),
    quality: resolveQuality(input.quality),
    realismMode: resolveRealismMode(input.realismMode),
    longVideo: input.longVideo === true,
    provider: input.provider?.trim() || DEFAULT_PROVIDER,
    model: input.model?.trim() || null,
    workspaceId: input.workspaceId?.trim() || "assistant-core",
    conversationId: input.conversationId?.trim() || undefined,
  };
}
