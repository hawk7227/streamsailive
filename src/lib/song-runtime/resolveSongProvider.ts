/**
 * src/lib/song-runtime/resolveSongProvider.ts
 *
 * Centralizes provider/model selection for song generation.
 * Reads environment availability and applies preference ordering.
 * Pure function — no network calls, no DB writes.
 *
 * Rules:
 * - Explicit provider override is respected if the key is configured
 * - "auto" resolves to suno if available, then udio
 * - If neither key is present, returns the requested provider (will fail at submit time)
 * - Model defaults are provider-specific
 */

import { SUNO_API_KEY, UDIO_API_KEY } from "@/lib/env";
import type { NormalizedSongRequest } from "./types";
import { SongRuntimeError } from "./types";

const SUNO_DEFAULT_MODEL = "chirp-v3-5";
const UDIO_DEFAULT_MODEL = "v1.5";

function hasSuno(): boolean { return !!SUNO_API_KEY; }
function hasUdio(): boolean { return !!UDIO_API_KEY; }

export function resolveSongProvider(
  req: NormalizedSongRequest,
): { provider: string; model: string | null } {
  const requested = req.provider.toLowerCase();

  if (requested === "suno") {
    if (!hasSuno()) {
      throw new SongRuntimeError("NO_PROVIDER_CONFIGURED", "SUNO_API_KEY is not set.");
    }
    return { provider: "suno", model: req.model || SUNO_DEFAULT_MODEL };
  }

  if (requested === "udio") {
    if (!hasUdio()) {
      throw new SongRuntimeError("NO_PROVIDER_CONFIGURED", "UDIO_API_KEY is not set.");
    }
    return { provider: "udio", model: req.model || UDIO_DEFAULT_MODEL };
  }

  // "auto" or any unrecognized provider — pick best available
  if (hasSuno()) {
    return { provider: "suno", model: req.model || SUNO_DEFAULT_MODEL };
  }
  if (hasUdio()) {
    return { provider: "udio", model: req.model || UDIO_DEFAULT_MODEL };
  }

  throw new SongRuntimeError(
    "NO_PROVIDER_CONFIGURED",
    "No song generation provider is configured. Set SUNO_API_KEY or UDIO_API_KEY.",
  );
}
