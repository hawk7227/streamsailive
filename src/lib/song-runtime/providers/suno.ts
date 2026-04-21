/**
 * song-runtime/providers/suno.ts
 *
 * Transport-only adapter for the Suno AI generation API.
 * Accepts normalized payload. Returns normalized result.
 * No model selection. No DB writes. No artifact logic.
 *
 * API base: https://api.suno.ai/v0
 *
 * Classification: Implemented but unproven.
 * Suno's API is not publicly documented. This implementation is built against
 * the known API shape observed in community usage. Endpoints or payload shapes
 * may differ from the production API. Verify with a live API key before deploying.
 *
 * Endpoints used:
 *   POST /v0/audio/generations       — submit a generation
 *   GET  /v0/audio/generations/{id}  — poll for status
 */

import { SUNO_API_KEY } from "@/lib/env";
import type {
  NormalizedSongRequest,
  SongProviderSubmitResult,
  SongProviderStatusResult,
} from "../types";

const SUNO_BASE = "https://api.suno.ai";
const SUBMIT_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 15_000;

function getApiKey(): string {
  const key = SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY is not set");
  return key;
}

function buildRequestBody(req: NormalizedSongRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: req.prompt,
    make_instrumental: req.instrumental,
    title: req.prompt.slice(0, 60),
  };

  if (req.genre || req.mood || req.tempo) {
    const tags = [req.genre, req.mood, req.tempo].filter(Boolean).join(", ");
    body.tags = tags;
  }

  if (req.lyrics) {
    body.custom_lyrics = req.lyrics;
  }

  if (req.referenceAudioUrl) {
    body.reference_audio_url = req.referenceAudioUrl;
  }

  return body;
}

/**
 * Submit a song generation to Suno.
 * Returns queued/processing if the job is async, completed if the audio is immediate.
 */
export async function submitSunoSong(
  req: NormalizedSongRequest,
): Promise<SongProviderSubmitResult> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (err) {
    return {
      accepted: false,
      provider: "suno",
      providerJobId: null,
      status: "failed",
      raw: err instanceof Error ? err.message : String(err),
    };
  }

  const body = buildRequestBody(req);

  try {
    const res = await fetch(`${SUNO_BASE}/v0/audio/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return {
        accepted: false,
        provider: "suno",
        providerJobId: null,
        status: "failed",
        raw: `Suno API error (${res.status}): ${errText}`,
      };
    }

    const data = await res.json() as {
      id?: string;
      audio_url?: string;
      title?: string;
      duration?: number;
      status?: string;
    };

    const providerJobId = data.id ?? null;
    const isComplete = data.status === "complete" || !!data.audio_url;

    return {
      accepted: true,
      provider: "suno",
      providerJobId,
      status: isComplete ? "completed" : "queued",
      outputUrl: data.audio_url ?? null,
      stemUrls: null, // Suno does not expose stems via this endpoint
      raw: data,
    };
  } catch (err) {
    return {
      accepted: false,
      provider: "suno",
      providerJobId: null,
      status: "failed",
      raw: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Poll a Suno generation by its provider job ID.
 * Returns the current status and output URL if complete.
 */
export async function pollSunoSong(
  providerJobId: string,
): Promise<SongProviderStatusResult> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    return {
      provider: "suno",
      providerJobId,
      status: "failed",
      raw: "SUNO_API_KEY not set",
    };
  }

  try {
    const res = await fetch(
      `${SUNO_BASE}/v0/audio/generations/${providerJobId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      },
    );

    if (!res.ok) {
      // Treat non-200 as still processing unless it's a 404/410
      if (res.status === 404 || res.status === 410) {
        return { provider: "suno", providerJobId, status: "failed", raw: `HTTP ${res.status}` };
      }
      return { provider: "suno", providerJobId, status: "processing", raw: `HTTP ${res.status}` };
    }

    const data = await res.json() as {
      id?: string;
      audio_url?: string;
      status?: string;
      duration?: number;
    };

    if (data.status === "failed" || data.status === "error") {
      return { provider: "suno", providerJobId, status: "failed", raw: data };
    }

    if (!data.audio_url || data.status === "pending" || data.status === "running") {
      return { provider: "suno", providerJobId, status: "processing", raw: data };
    }

    return {
      provider: "suno",
      providerJobId,
      status: "completed",
      outputUrl: data.audio_url,
      stemUrls: null,
      raw: data,
    };
  } catch (err) {
    // Network error — treat as still processing to allow retry
    return {
      provider: "suno",
      providerJobId,
      status: "processing",
      raw: err instanceof Error ? err.message : String(err),
    };
  }
}
