/**
 * video-runtime/providers/runway.ts
 * Transport only. Normalized submit + poll for Runway Gen4 API.
 */

import { RUNWAY_API_KEY } from "@/lib/env";
import type { ClipSpec, VideoProviderSubmitResult, VideoProviderStatusResult, VideoMode } from "../types";

const RUNWAY_VERSION = "2024-11-06";
const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 10_000;

function getBase(apiKey: string): string {
  return apiKey.startsWith("key_")
    ? "https://api.dev.runwayml.com"
    : "https://api.runwayml.com";
}

function toRunwayRatio(aspectRatio: string): string {
  if (aspectRatio === "9:16") return "720:1280";
  if (aspectRatio === "1:1") return "960:960";
  return "1280:720";
}

function toRunwayDuration(seconds: number): 5 | 10 {
  return seconds >= 10 ? 10 : 5;
}

export async function submitRunwayVideo(args: {
  clip: ClipSpec;
  model: string | null;
  mode: VideoMode;
  aspectRatio: string;
}): Promise<VideoProviderSubmitResult> {
  const apiKey = RUNWAY_API_KEY;
  if (!apiKey) {
    return { accepted: false, provider: "runway", providerJobId: null, status: "failed", raw: "RUNWAY_API_KEY not set" };
  }

  const ratio = toRunwayRatio(args.aspectRatio);
  const duration = toRunwayDuration(args.clip.durationSeconds);
  const base = getBase(apiKey);

  const body: Record<string, unknown> = {
    model: args.model || "gen4_turbo",
    promptText: args.clip.prompt,
    ratio,
    duration,
  };
  if (args.mode === "image_to_video" && args.clip.referenceImageUrl) {
    body.promptImage = args.clip.referenceImageUrl;
  }

  try {
    const res = await fetch(base + "/v1/tasks", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { accepted: false, provider: "runway", providerJobId: null, status: "failed", raw: text };
    }
    const data = await res.json() as { id?: string };
    if (!data.id) {
      return { accepted: false, provider: "runway", providerJobId: null, status: "failed", raw: data };
    }
    return { accepted: true, provider: "runway", providerJobId: data.id, status: "queued", raw: data };
  } catch (err) {
    return { accepted: false, provider: "runway", providerJobId: null, status: "failed", raw: err instanceof Error ? err.message : String(err) };
  }
}

export async function pollRunwayVideo(
  providerJobId: string,
): Promise<VideoProviderStatusResult> {
  const apiKey = RUNWAY_API_KEY;
  if (!apiKey) {
    return { provider: "runway", providerJobId, status: "failed", raw: "RUNWAY_API_KEY not set" };
  }

  const base = getBase(apiKey);
  try {
    const res = await fetch(base + "/v1/tasks/" + providerJobId, {
      headers: {
        Authorization: "Bearer " + apiKey,
        "X-Runway-Version": RUNWAY_VERSION,
      },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { provider: "runway", providerJobId, status: "processing", raw: null };
    }
    const d = await res.json() as { status: string; output?: string[] };
    if (d.status === "FAILED") return { provider: "runway", providerJobId, status: "failed", raw: d };
    if (d.status !== "SUCCEEDED") return { provider: "runway", providerJobId, status: "processing", raw: d };
    const outputUrl = d.output?.[0] ?? null;
    return { provider: "runway", providerJobId, status: outputUrl ? "completed" : "failed", outputUrl, raw: d };
  } catch (err) {
    return { provider: "runway", providerJobId, status: "processing", raw: err instanceof Error ? err.message : String(err) };
  }
}
