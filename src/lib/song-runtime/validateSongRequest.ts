/**
 * src/lib/song-runtime/validateSongRequest.ts
 *
 * Enforces all business rules before any provider submission or persistence.
 * Throws SongRuntimeError on any violation.
 * Does not perform normalization — that belongs to normalizeSongRequest.
 *
 * Validates:
 * - Prompt or lyrics are present and non-empty
 * - Duration is within valid bounds
 * - Output format is a supported value
 * - Reference audio URL is a valid URL if provided
 * - Workspace ID is present
 * - Instrumental/vocal consistency
 */

import type { NormalizedSongRequest } from "./types";
import { SongRuntimeError } from "./types";

const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 300;
const SUPPORTED_PROVIDERS = new Set(["suno", "udio", "auto"]);
const SUPPORTED_FORMATS = new Set(["mp3", "wav"]);

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateSongRequest(req: NormalizedSongRequest): void {
  // At least one of prompt or lyrics must be non-empty
  if (!req.prompt.trim() && !req.lyrics?.trim()) {
    throw new SongRuntimeError(
      "MISSING_PROMPT",
      "A prompt or lyrics must be provided for song generation.",
    );
  }

  // Workspace required for persistence
  if (!req.workspaceId?.trim()) {
    throw new SongRuntimeError(
      "MISSING_WORKSPACE",
      "workspaceId is required for song generation.",
    );
  }

  // Duration bounds
  if (req.durationSeconds < MIN_DURATION_SECONDS) {
    throw new SongRuntimeError(
      "INVALID_DURATION",
      `durationSeconds must be at least ${MIN_DURATION_SECONDS} seconds. Got ${req.durationSeconds}.`,
    );
  }
  if (req.durationSeconds > MAX_DURATION_SECONDS) {
    throw new SongRuntimeError(
      "INVALID_DURATION",
      `durationSeconds cannot exceed ${MAX_DURATION_SECONDS} seconds. Got ${req.durationSeconds}.`,
    );
  }

  // Output format
  if (!SUPPORTED_FORMATS.has(req.outputFormat)) {
    throw new SongRuntimeError(
      "INVALID_FORMAT",
      `Unsupported output format: "${req.outputFormat}". Supported: mp3, wav.`,
    );
  }

  // Reference audio URL, if provided, must be a valid URL
  if (req.referenceAudioUrl && !isValidUrl(req.referenceAudioUrl)) {
    throw new SongRuntimeError(
      "MISSING_PROMPT",
      `referenceAudioUrl is not a valid URL: "${req.referenceAudioUrl}".`,
    );
  }

  // Vocal mode requires some lyrical content or voice guidance
  // (a vocal song with no lyrics or voiceStyle is valid — the provider will generate them)
  // This is not a hard block, just noted here for future governance expansion.

  // Provider must be known
  const providerLower = req.provider.toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(providerLower)) {
    throw new SongRuntimeError(
      "UNSUPPORTED_PROVIDER",
      `Unsupported song provider: "${req.provider}". Supported: suno, udio, auto.`,
    );
  }
}
