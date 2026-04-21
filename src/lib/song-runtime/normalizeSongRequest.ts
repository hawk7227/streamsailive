/**
 * src/lib/song-runtime/normalizeSongRequest.ts
 *
 * Converts raw GenerateSongInput into a clean, typed NormalizedSongRequest.
 * Pure function — no side effects, no DB, no provider calls.
 *
 * Responsibilities:
 * - Normalize and trim all string fields
 * - Apply default values for optional fields
 * - Clamp numeric ranges
 * - Resolve instrumental flag
 * - Resolve output format
 * - Resolve stem requirement
 * - No validation of business rules (validateSongRequest owns that)
 */

import type { GenerateSongInput, NormalizedSongRequest } from "./types";

const DEFAULT_DURATION_SECONDS = 60;
const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 300;
const DEFAULT_PROVIDER = "suno";

function parseDurationSeconds(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_DURATION_SECONDS;
  }
  return Math.min(Math.max(Math.round(value), MIN_DURATION_SECONDS), MAX_DURATION_SECONDS);
}

function resolveOutputFormat(value?: string): "mp3" | "wav" {
  return value === "wav" ? "wav" : "mp3";
}

function resolveProvider(value?: string): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (trimmed === "udio" || trimmed === "suno" || trimmed === "auto") return trimmed;
  if (trimmed) return trimmed;
  return DEFAULT_PROVIDER;
}

export function normalizeSongRequest(input: GenerateSongInput): NormalizedSongRequest {
  const prompt = input.prompt?.trim() ?? "";
  const lyrics = input.lyrics?.trim() || undefined;

  // If lyrics are provided and no explicit instrumental flag, default to vocal
  const instrumental =
    typeof input.instrumental === "boolean"
      ? input.instrumental
      : !lyrics; // no lyrics → default instrumental

  return {
    prompt,
    lyrics,
    instrumental,
    durationSeconds: parseDurationSeconds(input.durationSeconds),
    genre: input.genre?.trim() || undefined,
    mood: input.mood?.trim() || undefined,
    tempo: input.tempo?.trim() || undefined,
    referenceAudioUrl: input.referenceAudioUrl?.trim() || undefined,
    voiceStyle: input.voiceStyle?.trim() || undefined,
    workspaceId: input.workspaceId?.trim() || "assistant-core",
    conversationId: input.conversationId?.trim() || undefined,
    provider: resolveProvider(input.provider),
    model: input.model?.trim() || null,
    outputFormat: resolveOutputFormat(input.outputFormat),
    requireStems: input.requireStems === true,
  };
}
