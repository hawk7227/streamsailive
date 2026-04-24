/**
 * src/lib/streams/fal-direct.ts
 *
 * Direct browser → fal.ai. No Vercel hop.
 * Reads the fal key from sessionStorage (set by SettingsTab on save).
 * Browser submits and polls fal queue directly.
 */

import { getProviderKey } from "./provider-keys";

const FAL_QUEUE = "https://queue.fal.run";

export type FalProgressHandler = (status: string, logs?: string[]) => void;
export type FalDoneHandler     = (raw: unknown) => void;
export type FalErrorHandler    = (err: string) => void;

export interface FalDirectOptions {
  endpoint:   string;
  input:      Record<string, unknown>;
  onProgress: FalProgressHandler;
  onDone:     FalDoneHandler;
  onError:    FalErrorHandler;
  signal?:    AbortSignal;
  pollMs?:    number;   // default 3000
  maxPolls?:  number;   // default 60 (~3 min)
}

function getKey(): string | null {
  return getProviderKey("fal");
}

export async function submitDirectToFal(opts: FalDirectOptions): Promise<void> {
  const key = getKey();
  if (!key) {
    opts.onError("fal key not set — go to Settings → API Keys, paste your fal key and save.");
    return;
  }

  const { endpoint, input, onProgress, onDone, onError, signal } = opts;
  const pollMs   = opts.pollMs   ?? 3000;
  const maxPolls = opts.maxPolls ?? 60;

  // ── Step 1: Submit ───────────────────────────────────────────────────────
  let responseUrl: string;
  try {
    onProgress("Submitting…");
    const res = await fetch(`${FAL_QUEUE}/${endpoint}`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Key ${key}`,
      },
      body:   JSON.stringify(input),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => `HTTP ${res.status}`);
      onError(`fal submit failed: ${body.slice(0, 200)}`);
      return;
    }

    const data = await res.json() as { response_url?: string; request_id?: string };
    responseUrl = (data.response_url ?? data.request_id) as string;
    if (!responseUrl) {
      onError("fal did not return a response_url");
      return;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Submit failed");
    return;
  }

  // ── Step 2: Poll status ──────────────────────────────────────────────────
  let polls = 0;
  while (polls < maxPolls) {
    if (signal?.aborted) return;
    await new Promise(r => setTimeout(r, pollMs));
    polls++;

    try {
      const statusRes = await fetch(`${responseUrl}/status`, {
        headers: { "Authorization": `Key ${key}` },
        signal,
      });

      if (!statusRes.ok) continue;

      const status = await statusRes.json() as {
        status?: string;
        logs?:   Array<{ message: string }>;
      };

      const s = (status.status ?? "").toUpperCase();
      const logs = status.logs?.map(l => l.message) ?? [];

      if (s === "FAILED" || s === "CANCELLED") {
        onError(`fal job ${s.toLowerCase()}`);
        return;
      }

      if (s === "COMPLETED") break;

      // IN_QUEUE or IN_PROGRESS
      onProgress(s === "IN_PROGRESS" ? "Generating…" : "Queued…", logs);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // Poll error — keep trying
    }
  }

  if (polls >= maxPolls) {
    onError("Generation timed out — job is still running on fal, check your library");
    return;
  }

  // ── Step 3: Fetch result ─────────────────────────────────────────────────
  try {
    const resultRes = await fetch(responseUrl, {
      headers: { "Authorization": `Key ${key}` },
      signal,
    });

    if (!resultRes.ok) {
      onError(`fal result fetch failed: HTTP ${resultRes.status}`);
      return;
    }

    const result = await resultRes.json();
    onDone(result);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Result fetch failed");
  }
}

// ── Result extractors (same logic as server-side fal-client.ts) ─────────────

export function extractVideoUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.video && typeof (r.video as Record<string,unknown>).url === "string")
    return (r.video as Record<string,unknown>).url as string;
  if (typeof r.video_url === "string") return r.video_url;
  if (typeof r.url === "string") return r.url;
  if (Array.isArray(r.videos) && r.videos[0]) {
    const v = r.videos[0] as Record<string,unknown>;
    if (typeof v.url === "string") return v.url;
  }
  return null;
}

export function extractImageUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.images) && r.images[0]) {
    const img = r.images[0] as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  if (r.image && typeof (r.image as Record<string,unknown>).url === "string")
    return (r.image as Record<string,unknown>).url as string;
  if (typeof r.url === "string") return r.url;
  if (typeof r.image_url === "string") return r.image_url;
  return null;
}

export function extractAudioUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.audio && typeof (r.audio as Record<string,unknown>).url === "string")
    return (r.audio as Record<string,unknown>).url as string;
  if (typeof r.audio_url === "string") return r.audio_url;
  if (typeof r.url === "string") return r.url;
  return null;
}

export function extractMusicUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.music_file && typeof (r.music_file as Record<string,unknown>).url === "string")
    return (r.music_file as Record<string,unknown>).url as string;
  return extractAudioUrl(raw);
}
