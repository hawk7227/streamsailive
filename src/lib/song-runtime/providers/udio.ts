/**
 * song-runtime/providers/udio.ts
 *
 * Transport-only adapter for the Udio generation API.
 * Accepts normalized payload. Returns normalized result.
 * No model selection. No DB writes. No artifact logic.
 *
 * API base: https://www.udio.com/api
 *
 * Classification: Implemented but unproven.
 * Udio does not publish a formal public API. This implementation is built against
 * the undocumented API shape observed in community usage. Endpoints, authentication,
 * and payload shapes may change without notice. Verify with a live API key before deploying.
 *
 * Endpoints used:
 *   POST /api/generations       — submit a generation
 *   GET  /api/generations/{id}  — poll for status
 */

import { UDIO_API_KEY } from "@/lib/env";
import type {
  NormalizedSongRequest,
  SongProviderSubmitResult,
  SongProviderStatusResult,
} from "../types";

const UDIO_BASE = "https://www.udio.com";
const SUBMIT_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 15_000;

function getApiKey(): string {
  const key = UDIO_API_KEY;
  if (!key) throw new Error("UDIO_API_KEY is not set");
  return key;
}

function buildRequestBody(req: NormalizedSongRequest): Record<string, unknown> {
  const tags: string[] = [];
  if (req.genre) tags.push(req.genre);
  if (req.mood) tags.push(req.mood);
  if (req.instrumental) tags.push("instrumental");

  const body: Record<string, unknown> = {
    prompt: req.prompt,
    tags,
    title: req.prompt.slice(0, 60),
  };

  if (req.lyrics) {
    body.lyrics = req.lyrics;
  }

  if (req.referenceAudioUrl) {
    body.reference_audio = req.referenceAudioUrl;
  }

  return body;
}

/**
 * Submit a song generation to Udio.
 */
export async function submitUdioSong(
  req: NormalizedSongRequest,
): Promise<SongProviderSubmitResult> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (err) {
    return {
      accepted: false,
      provider: "udio",
      providerJobId: null,
      status: "failed",
      raw: err instanceof Error ? err.message : String(err),
    };
  }

  const body = buildRequestBody(req);

  try {
    const res = await fetch(`${UDIO_BASE}/api/generations`, {
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
        provider: "udio",
        providerJobId: null,
        status: "failed",
        raw: `Udio API error (${res.status}): ${errText}`,
      };
    }

    const data = await res.json() as {
      id?: string;
      song_path?: string;
      title?: string;
      duration?: number;
      status?: string;
    };

    const providerJobId = data.id ?? null;
    const isComplete = !!data.song_path;

    return {
      accepted: true,
      provider: "udio",
      providerJobId,
      status: isComplete ? "completed" : "queued",
      outputUrl: data.song_path ?? null,
      stemUrls: null,
      raw: data,
    };
  } catch (err) {
    return {
      accepted: false,
      provider: "udio",
      providerJobId: null,
      status: "failed",
      raw: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Poll a Udio generation by its provider job ID.
 */
export async function pollUdioSong(
  providerJobId: string,
): Promise<SongProviderStatusResult> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    return {
      provider: "udio",
      providerJobId,
      status: "failed",
      raw: "UDIO_API_KEY not set",
    };
  }

  try {
    const res = await fetch(
      `${UDIO_BASE}/api/generations/${providerJobId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      },
    );

    if (!res.ok) {
      if (res.status === 404 || res.status === 410) {
        return { provider: "udio", providerJobId, status: "failed", raw: `HTTP ${res.status}` };
      }
      return { provider: "udio", providerJobId, status: "processing", raw: `HTTP ${res.status}` };
    }

    const data = await res.json() as {
      id?: string;
      song_path?: string;
      status?: string;
      duration?: number;
    };

    if (data.status === "failed" || data.status === "error") {
      return { provider: "udio", providerJobId, status: "failed", raw: data };
    }

    if (!data.song_path) {
      return { provider: "udio", providerJobId, status: "processing", raw: data };
    }

    return {
      provider: "udio",
      providerJobId,
      status: "completed",
      outputUrl: data.song_path,
      stemUrls: null,
      raw: data,
    };
  } catch (err) {
    return {
      provider: "udio",
      providerJobId,
      status: "processing",
      raw: err instanceof Error ? err.message : String(err),
    };
  }
}
