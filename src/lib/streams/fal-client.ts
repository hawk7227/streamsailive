/**
 * src/lib/streams/fal-client.ts
 *
 * OWNED fal.ai transport layer for the Streams panel.
 * Copied pattern from video-runtime/providers/fal.ts — not imported from it.
 * This file owns its own transport contract independently of all other runtimes.
 *
 * Three layers:
 *   1. Transport — submit, poll, result (generic, no endpoint knowledge)
 *   2. Extractors — typed result shapes per endpoint category
 *   3. Endpoint registry — canonical endpoint strings, single source of truth
 *
 * Rules enforced here:
 *   - server-only: never imported by client components
 *   - no DB writes: transport only
 *   - no model selection: caller passes the full endpoint string
 *   - no fake results: if fal returns non-COMPLETED, status is processing or failed
 *   - FAL_API_KEY only: FAL_KEY is a duplicate constant in env.ts — we use FAL_API_KEY
 */

// SERVER ONLY — import only from /app/api/streams/* routes.
import { FAL_API_KEY } from "@/lib/env";

// ─── Timeouts ────────────────────────────────────────────────────────────────

const SUBMIT_TIMEOUT_MS  = 30_000;
const POLL_TIMEOUT_MS    = 10_000;
const RESULT_TIMEOUT_MS  = 15_000;

// ─── Endpoint registry ───────────────────────────────────────────────────────
// Single source of truth for all fal endpoint strings used by the panel.
// Add new endpoints here — never inline strings elsewhere.

export const FAL_ENDPOINTS = {
  // Video — text to video
  KLING_V3_T2V:           "fal-ai/kling-video/v3/standard/text-to-video",
  KLING_V3_PRO_T2V:       "fal-ai/kling-video/v3/pro/text-to-video",
  KLING_O3_T2V:           "fal-ai/kling-video/o3/standard/text-to-video",
  VEO_31_T2V:             "fal-ai/veo3.1/text-to-video",
  SEEDANCE_V2_T2V:        "fal-ai/bytedance/seedance/v2/text-to-video",

  // Video — image to video
  KLING_V3_I2V:           "fal-ai/kling-video/v3/standard/image-to-video",
  KLING_V3_PRO_I2V:       "fal-ai/kling-video/v3/pro/image-to-video",
  KLING_O3_I2V:           "fal-ai/kling-video/o3/standard/image-to-video",
  VEO_31_I2V:             "fal-ai/veo3.1/image-to-video",
  SEEDANCE_V2_I2V:        "fal-ai/bytedance/seedance/v2/image-to-video",
  SEEDANCE_V2_R2V:        "fal-ai/bytedance/seedance/v2/reference-to-video",
  VEO_31_FIRST_LAST:      "fal-ai/veo3.1/fast/first-last-frame-to-video",
  VEO_31_REFERENCE:       "fal-ai/veo3.1/reference-to-video",

  // Video — motion / lipsync / avatar
  KLING_MOTION_CONTROL:   "fal-ai/kling-video/v3/standard/motion-control",
  KLING_LIPSYNC:          "fal-ai/kling-video/lipsync/audio-to-video",
  SYNC_LIPSYNC_V2:        "fal-ai/sync-lipsync/v2",
  SYNC_LIPSYNC_V3:        "fal-ai/sync-lipsync/sync-3",
  SYNC_REACT_1:           "fal-ai/sync-lipsync/react-1",
  OMNIHUMAN_V15:          "fal-ai/bytedance/omnihuman/v1.5",
  AI_AVATAR:              "fal-ai/ai-avatar/single-text",

  // Video — ffmpeg operations
  FFMPEG_MERGE_VIDEOS:    "fal-ai/ffmpeg-api/merge-videos",   // stitch: end-to-end concat
  FFMPEG_COMPOSE:         "fal-ai/ffmpeg-api/compose",        // splice: timestamp-accurate insert
  FFMPEG_MERGE_AUDIOS:    "fal-ai/ffmpeg-api/merge-audios",   // audio track merge
  FFMPEG_MERGE_AV:        "fal-ai/ffmpeg-api/merge-audio-video",

  // Video — analysis / enhancement
  VIDEO_UNDERSTANDING:    "fal-ai/video-understanding",
  VIDEO_BG_REMOVE:        "fal-ai/remove-background-video",
  VIDEO_UPSCALE:          "fal-ai/topaz/video-upscale",

  // Audio — ElevenLabs via fal
  EL_TTS_V3:              "fal-ai/elevenlabs/tts/eleven-v3",
  EL_AUDIO_ISOLATION:     "fal-ai/elevenlabs/audio-isolation",
  EL_SPEECH_TO_TEXT:      "fal-ai/elevenlabs/speech-to-text",
  EL_DUBBING:             "fal-ai/elevenlabs/dubbing",
  EL_VOICE_CHANGER:       "fal-ai/elevenlabs/voice-changer",
  EL_MUSIC:               "fal-ai/elevenlabs/music",

  // Audio — music
  MINIMAX_MUSIC_V26:      "fal-ai/minimax-music/v2.6",
  MINIMAX_MUSIC_V25:      "fal-ai/minimax-music/v2.5",

  // Image
  FLUX_KONTEXT:           "fal-ai/flux-pro/kontext",
  FLUX_KONTEXT_MAX:       "fal-ai/flux-pro/kontext/max/multi",
  FLUX_PRO_V2:            "fal-ai/flux-pro/v2",
  RECRAFT_V4_IMAGE:       "fal-ai/recraft/v4/text-to-image",
  RECRAFT_V4_VECTOR:      "fal-ai/recraft/v4/text-to-vector",
  RECRAFT_V3_STYLE:       "fal-ai/recraft/v3/create-style",
  NANO_BANANA_2:          "fal-ai/nano-banana-2/text-to-image",
  SEEDREAM_V3:            "fal-ai/seedream/v3/text-to-image",
  IMAGE_BG_REMOVE:        "fal-ai/bria/rmbg-2.0",
} as const;

export type FalEndpoint = typeof FAL_ENDPOINTS[keyof typeof FAL_ENDPOINTS];

// ─── Transport types ──────────────────────────────────────────────────────────

export type FalSubmitResult =
  | { ok: true;  responseUrl: string; requestId: string | null }
  | { ok: false; error: string };

export type FalPollStatus = "processing" | "completed" | "failed";

export type FalPollResult =
  | { status: "processing" }
  | { status: "failed";    error: string }
  | { status: "completed"; raw: unknown };

// ─── Layer 1: Transport ───────────────────────────────────────────────────────

function apiKey(): string | undefined {
  // FAL_API_KEY is the correct constant. FAL_KEY is a duplicate in env.ts — do not use.
  return FAL_API_KEY;
}

/**
 * Submit a job to any fal endpoint.
 * Returns the response_url used for polling and result retrieval.
 */
export async function falSubmit(
  endpoint: string,
  input: Record<string, unknown>,
): Promise<FalSubmitResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "FAL_API_KEY is not set" };
  }

  try {
    const res = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${key}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      return {
        ok: false,
        error: body.detail ?? `fal rejected with ${res.status}`,
      };
    }

    const data = await res.json() as {
      request_id?: string;
      response_url?: string;
    };

    const responseUrl = data.response_url ?? null;
    if (!responseUrl) {
      return { ok: false, error: "fal did not return a response_url" };
    }

    return { ok: true, responseUrl, requestId: data.request_id ?? null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Poll a fal job by its response_url.
 * Returns processing / completed (with raw payload) / failed.
 */
export async function falPoll(responseUrl: string): Promise<FalPollResult> {
  const key = apiKey();
  if (!key) return { status: "failed", error: "FAL_API_KEY is not set" };

  try {
    const statusRes = await fetch(`${responseUrl}/status`, {
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });

    if (!statusRes.ok) {
      // Non-200 on status check — treat as still processing, not fatal
      return { status: "processing" };
    }

    const statusData = await statusRes.json() as { status: string };

    if (statusData.status === "FAILED") {
      return { status: "failed", error: "fal reported FAILED status" };
    }

    if (statusData.status !== "COMPLETED") {
      return { status: "processing" };
    }

    // Fetch the full result
    const resultRes = await fetch(responseUrl, {
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(RESULT_TIMEOUT_MS),
    });

    if (!resultRes.ok) {
      return { status: "failed", error: `result fetch failed: ${resultRes.status}` };
    }

    const raw = await resultRes.json();
    return { status: "completed", raw };
  } catch (err) {
    // Network / timeout errors during poll are not fatal — job may still be running
    return { status: "processing" };
  }
}

// ─── Layer 2: Typed result extractors ─────────────────────────────────────────
// Each extractor accepts the raw completed payload and pulls the typed output.
// Add one extractor per endpoint category — never guess shapes.

/** Video generation endpoints: { video: { url: string } } */
export function extractVideoUrl(raw: unknown): string | null {
  const r = raw as { video?: { url?: string } };
  return r?.video?.url ?? null;
}

/** Image generation endpoints: { images: [{ url: string }] } */
export function extractImageUrl(raw: unknown): string | null {
  const r = raw as { images?: { url?: string }[] };
  return r?.images?.[0]?.url ?? null;
}

/** Audio endpoints that return a single audio URL: { audio: { url: string } } */
export function extractAudioUrl(raw: unknown): string | null {
  const r = raw as {
    audio?: { url?: string };
    audio_url?: string;
    url?: string;
  };
  return r?.audio?.url ?? r?.audio_url ?? r?.url ?? null;
}

/** Audio isolation: returns voice track + ambient track separately */
export function extractIsolatedTracks(raw: unknown): {
  voiceUrl: string | null;
  ambientUrl: string | null;
} {
  const r = raw as {
    audio_url?: string;
    background_audio_url?: string;
  };
  return {
    voiceUrl:   r?.audio_url ?? null,
    ambientUrl: r?.background_audio_url ?? null,
  };
}

/** Scribe v2 STT: word-level transcript */
export type TranscriptWord = {
  word: string;
  startMs: number;
  endMs: number;
  speaker: string;
  confidence: number;
};

export function extractTranscript(raw: unknown): {
  text: string;
  words: TranscriptWord[];
} {
  const r = raw as {
    text?: string;
    words?: {
      word?: string;
      start?: number;
      end?: number;
      speaker?: string;
      confidence?: number;
    }[];
  };

  const words: TranscriptWord[] = (r?.words ?? []).map((w) => ({
    word:       w.word       ?? "",
    // Scribe v2 returns timestamps in seconds — convert to ms
    startMs:    Math.round((w.start ?? 0) * 1000),
    endMs:      Math.round((w.end   ?? 0) * 1000),
    speaker:    w.speaker    ?? "speaker_0",
    confidence: w.confidence ?? 1,
  }));

  return { text: r?.text ?? "", words };
}

/** Video understanding: free-text analysis */
export function extractVideoUnderstanding(raw: unknown): string {
  const r = raw as { text?: string; output?: string };
  return r?.text ?? r?.output ?? "";
}

/** ffmpeg merge/compose: { video: { url: string } } — same as video gen */
export const extractFfmpegUrl = extractVideoUrl;

/** Music generation: varies by provider */
export function extractMusicUrl(raw: unknown): string | null {
  const r = raw as {
    audio?: { url?: string };
    audio_url?: string;
    song_url?: string;
    url?: string;
  };
  return r?.audio?.url ?? r?.audio_url ?? r?.song_url ?? r?.url ?? null;
}
