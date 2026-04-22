/**
 * src/lib/streams/fal-client.ts
 *
 * Streams panel fal.ai transport layer.
 * Owned by the streams panel — not imported from video-runtime.
 * Pattern copied from video-runtime/providers/fal.ts, not imported.
 *
 * Exports:
 *   falSubmit(endpoint, input)  → { ok, responseUrl } | { ok:false, error }
 *   falPoll(responseUrl)        → { status: 'processing'|'failed'|'completed', raw }
 *   FAL_ENDPOINTS               → registry of all 40 fal endpoints used by the panel
 *   extractVideoUrl(raw)        → string | null
 *   extractAudioUrl(raw)        → string | null
 *   extractMusicUrl(raw)        → string | null
 *   extractTranscript(raw)      → Word[] | null
 *
 * All calls go through the fal queue API:
 *   Submit:  POST https://queue.fal.run/{endpoint}
 *   Status:  GET  {responseUrl}/status
 *   Result:  GET  {responseUrl}
 *
 * FAL_API_KEY is never exposed to the client. All calls are server-side only.
 */

import { FAL_API_KEY } from "@/lib/env";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Word {
  word:     string;
  start_ms: number;
  end_ms:   number;
  speaker?: string;
}

type SubmitOk    = { ok: true;  responseUrl: string };
type SubmitFail  = { ok: false; error: string };
export type SubmitResult = SubmitOk | SubmitFail;

export type PollStatus = "processing" | "failed" | "completed";
export interface PollResult {
  status: PollStatus;
  raw:    unknown;
}

// ─── Timeouts ──────────────────────────────────────────────────────────────

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS   = 15_000;
const FAL_QUEUE_BASE    = "https://queue.fal.run";

// ─── Endpoint registry ─────────────────────────────────────────────────────
// All 40 fal endpoints used by the panel. Single source of truth.
// Endpoint strings never appear in route files — always imported from here.

export const FAL_ENDPOINTS = {
  // Video — Text to Video
  KLING_V3_T2V:     "fal-ai/kling-video/v3/standard/text-to-video",
  KLING_V3_PRO_T2V: "fal-ai/kling-video/v3/pro/text-to-video",
  KLING_O3_T2V:     "fal-ai/kling-video/v3/standard/text-to-video", // O3 T2V not confirmed — use v3 standard
  VEO_T2V:          "fal-ai/veo3.1",
  SEEDANCE_T2V:     "fal-ai/bytedance/seedance/v1/lite/text-to-video",

  // Video — Image to Video
  KLING_V3_I2V:     "fal-ai/kling-video/v3/standard/image-to-video",
  KLING_V3_PRO_I2V: "fal-ai/kling-video/v3/pro/image-to-video",
  KLING_O3_I2V:     "fal-ai/kling-video/o3/standard/image-to-video",  // uses image_url not start_image_url
  VEO_I2V:          "fal-ai/veo3.1/image-to-video",
  VEO_FLF:          "fal-ai/veo3.1/fast/first-last-frame-to-video",

  // Video — Motion Control / V2V
  KLING_MOTION:     "fal-ai/kling-video/v3/standard/motion-control",
  VEO_EXTEND:       "fal-ai/veo3.1/fast/extend-video",
  VEO_REFERENCE:    "fal-ai/veo3.1/reference-to-video",

  // Video — OmniHuman (full body driven by audio)
  OMNIHUMAN:        "fal-ai/bytedance/omnihuman/v1.5",

  // Image — FLUX
  FLUX_KONTEXT:     "fal-ai/flux-pro/kontext/text-to-image",
  FLUX_KONTEXT_EDIT:"fal-ai/flux-pro/kontext",
  FLUX_KONTEXT_MAX: "fal-ai/flux-pro/kontext-max/text-to-image",
  FLUX_PRO:         "fal-ai/flux-pro",
  FLUX_DEV:         "fal-ai/flux/dev",
  FLUX_LORA:        "fal-ai/flux-lora",

  // Image — Recraft
  RECRAFT_V4:       "fal-ai/recraft-v3",
  RECRAFT_STYLE:    "fal-ai/recraft/v3/create-style",
  SEEDREAM:         "fal-ai/seedream/v4.5",

  // Audio — ElevenLabs
  ELEVENLABS_TTS:   "fal-ai/elevenlabs/tts/eleven-v3",
  ELEVENLABS_TTS_TURBO: "fal-ai/elevenlabs/tts/turbo-v2.5",
  ELEVENLABS_SFX:   "fal-ai/elevenlabs/sound-effects",
  ELEVENLABS_ISOLATION: "fal-ai/elevenlabs/audio-isolation",
  ELEVENLABS_SCRIBE:    "fal-ai/elevenlabs/speech-to-text",
  ELEVENLABS_DUBBING:   "fal-ai/elevenlabs/dubbing",
  ELEVENLABS_MUSIC:     "fal-ai/elevenlabs/music",

  // Music — MiniMax
  MINIMAX_V26:      "fal-ai/minimax-music/v2.6",
  MINIMAX_V25:      "fal-ai/minimax-music/v2.5",
  MINIMAX_DRAFT:    "fal-ai/minimax-music/v2",
  MINIMAX_REF:      "fal-ai/minimax-music",

  // Lipsync
  SYNC_LIPSYNC:     "fal-ai/sync-lipsync/v2",
  SYNC_REACT:       "fal-ai/sync-lipsync/react-1",

  // Video effects / sound
  MMAUDIO:          "fal-ai/mmaudio-v2",
  PIXVERSE_EFFECTS: "fal-ai/pixverse/v5.6/effects",
  PIXVERSE_TRANSITIONS: "fal-ai/pixverse/v5.6/transitions",
  TOPAZ_UPSCALE:    "fal-ai/topaz/video-upscale",

  // ffmpeg — all operations via fal's ffmpeg API
  FFMPEG_COMPOSE:   "fal-ai/ffmpeg-api/compose",        // splice at timestamp — use for word edits
  FFMPEG_MERGE:     "fal-ai/ffmpeg-api/merge-videos",   // concat full clips — use for stitch only
  FFMPEG_MERGE_AV:  "fal-ai/ffmpeg-api/merge-audio-video",
  FFMPEG_METADATA:  "fal-ai/ffmpeg-api/metadata",
} as const;

export type FalEndpoint = typeof FAL_ENDPOINTS[keyof typeof FAL_ENDPOINTS];

// ─── Core transport ────────────────────────────────────────────────────────

function getKey(): string {
  const key = FAL_API_KEY;
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
}

/**
 * Submit a job to the fal async queue.
 * Returns immediately with a responseUrl (polling handle).
 * Never polls — caller is responsible for polling via falPoll.
 */
export async function falSubmit(
  endpoint: string,
  input:    Record<string, unknown>,
): Promise<SubmitResult> {
  let key: string;
  try { key = getKey(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const url = `${FAL_QUEUE_BASE}/${endpoint}`;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${key}`,
      },
      body:   JSON.stringify(input),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `fal submit HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const responseUrl = (data.response_url ?? data.request_id) as string | undefined;

    if (!responseUrl) {
      return { ok: false, error: "fal submit: no response_url in response" };
    }

    return { ok: true, responseUrl };
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : "fal submit: unknown error",
    };
  }
}

/**
 * Poll a fal queue job.
 * Returns processing, failed, or completed with the raw result.
 */
export async function falPoll(responseUrl: string): Promise<PollResult> {
  let key: string;
  try { key = getKey(); } catch {
    return { status: "failed", raw: null };
  }

  try {
    // Step 1: check status
    const statusRes = await fetch(`${responseUrl}/status`, {
      headers: { "Authorization": `Key ${key}` },
      signal:  AbortSignal.timeout(POLL_TIMEOUT_MS),
    });

    if (!statusRes.ok) {
      return { status: "failed", raw: null };
    }

    const statusData = await statusRes.json() as Record<string, unknown>;
    const falStatus  = (statusData.status as string ?? "").toUpperCase();

    if (falStatus === "FAILED" || falStatus === "CANCELLED") {
      return { status: "failed", raw: statusData };
    }

    if (falStatus !== "COMPLETED") {
      // IN_QUEUE, IN_PROGRESS, etc.
      return { status: "processing", raw: statusData };
    }

    // Step 2: fetch the result
    const resultRes = await fetch(responseUrl, {
      headers: { "Authorization": `Key ${key}` },
      signal:  AbortSignal.timeout(POLL_TIMEOUT_MS),
    });

    if (!resultRes.ok) {
      return { status: "failed", raw: null };
    }

    const resultData = await resultRes.json();
    return { status: "completed", raw: resultData };
  } catch (err) {
    return {
      status: "failed",
      raw:    err instanceof Error ? err.message : "poll error",
    };
  }
}

// ─── Result extractors ─────────────────────────────────────────────────────
// Each extractor handles the specific shape each endpoint returns.
// Returns null if the expected field is not present.

export function extractVideoUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Kling v3: { video: { url } }
  if (r.video && typeof (r.video as Record<string,unknown>).url === "string") {
    return (r.video as Record<string,unknown>).url as string;
  }
  // Veo / other: { video_url: string }
  if (typeof r.video_url === "string") return r.video_url;
  // Fallback: { url: string }
  if (typeof r.url === "string") return r.url;
  // Array: { videos: [{ url }] }
  if (Array.isArray(r.videos) && r.videos[0]) {
    const v = r.videos[0] as Record<string,unknown>;
    if (typeof v.url === "string") return v.url;
  }

  return null;
}

export function extractAudioUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // ElevenLabs TTS / SFX: { audio: { url } } or { audio_url: string }
  if (r.audio && typeof (r.audio as Record<string,unknown>).url === "string") {
    return (r.audio as Record<string,unknown>).url as string;
  }
  if (typeof r.audio_url === "string") return r.audio_url;
  if (typeof r.url       === "string") return r.url;

  return null;
}

export function extractMusicUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // MiniMax Music: { music_file: { url } } or { audio: { url } }
  if (r.music_file && typeof (r.music_file as Record<string,unknown>).url === "string") {
    return (r.music_file as Record<string,unknown>).url as string;
  }
  // Fallback to audio extractor
  return extractAudioUrl(raw);
}

export function extractImageUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // FLUX Kontext / FLUX Dev: { images: [{ url, content_type }] }
  if (Array.isArray(r.images) && r.images[0]) {
    const img = r.images[0] as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  // Recraft / others: { image: { url } }
  if (r.image && typeof (r.image as Record<string,unknown>).url === "string") {
    return (r.image as Record<string,unknown>).url as string;
  }
  // Seedream / fallback: { url: string }
  if (typeof r.url === "string") return r.url;
  // image_url direct
  if (typeof r.image_url === "string") return r.image_url;

  return null;
}

export function extractTranscript(raw: unknown): Word[] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // ElevenLabs Scribe v2: { words: [{ word, start, end }] }
  if (Array.isArray(r.words)) {
    return r.words.map((w: Record<string,unknown>) => ({
      word:     String(w.word     ?? ""),
      start_ms: Number(w.start    ?? w.start_ms ?? 0) * (w.start !== undefined ? 1000 : 1),
      end_ms:   Number(w.end      ?? w.end_ms   ?? 0) * (w.end   !== undefined ? 1000 : 1),
      speaker:  w.speaker_id ? String(w.speaker_id) : undefined,
    }));
  }

  return null;
}
