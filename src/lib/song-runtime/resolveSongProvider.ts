/**
 * src/lib/song-runtime/resolveSongProvider.ts
 *
 * Centralizes provider/model selection for song generation.
 * Pure function — no network calls, no DB writes.
 *
 * Provider map (all via FAL_KEY — no separate provider keys needed):
 *   minimax        → fal-ai/minimax-music/v2.6  (default, $0.15/gen, up to 6 min)
 *   minimax-draft  → fal-ai/minimax-music/v2    (fast draft, $0.03/gen)
 *   minimax-ref    → fal-ai/minimax-music        (v1, style-match via reference_audio_url)
 *   elevenlabs     → fal-ai/elevenlabs/music     (commercial-safe, $0.80/min)
 *   auto           → minimax (default)
 *
 * Previous providers (suno/udio) had no fal.ai endpoints and could never
 * successfully submit jobs. Removed entirely.
 *
 * Two-prompt rule enforced at this layer:
 *   prompt  = STYLE ONLY (genre, mood, BPM, key — 10–300 chars)
 *   lyrics  = WORDS + structure tags ([Verse][Chorus][Bridge] etc.)
 *   Never put lyrics in prompt. Never put style in lyrics.
 */

import { FAL_API_KEY } from "@/lib/env";
import type { NormalizedSongRequest } from "./types";
import { SongRuntimeError } from "./types";

// ── Model → fal endpoint mapping ─────────────────────────────────────────────
const PROVIDER_ENDPOINTS: Record<string, string> = {
  "minimax":       "fal-ai/minimax-music/v2.6",
  "minimax-draft": "fal-ai/minimax-music/v2",
  "minimax-ref":   "fal-ai/minimax-music",
  "elevenlabs":    "fal-ai/elevenlabs/music",
};

const DEFAULT_PROVIDER = "minimax";
const DEFAULT_MODEL     = "fal-ai/minimax-music/v2.6";

function hasFal(): boolean {
  return !!FAL_API_KEY;
}

export function resolveSongProvider(
  req: NormalizedSongRequest,
): { provider: string; model: string | null } {
  // All music providers route through FAL_KEY
  if (!hasFal()) {
    throw new SongRuntimeError(
      "NO_PROVIDER_CONFIGURED",
      "FAL_API_KEY is not set. All music generation routes through fal.ai.",
    );
  }

  const requested = (req.provider ?? "auto").toLowerCase();

  // Reject old providers that no longer have endpoints
  if (requested === "suno" || requested === "udio") {
    throw new SongRuntimeError(
      "UNSUPPORTED_PROVIDER",
      `Provider "${requested}" has no fal.ai endpoint. Use "minimax" (default) or "elevenlabs".`,
    );
  }

  // "auto" or unrecognized → default to minimax v2.6
  const resolved = (requested === "auto" || !PROVIDER_ENDPOINTS[requested])
    ? DEFAULT_PROVIDER
    : requested;

  const endpoint = PROVIDER_ENDPOINTS[resolved] ?? DEFAULT_MODEL;

  return { provider: resolved, model: endpoint };
}
