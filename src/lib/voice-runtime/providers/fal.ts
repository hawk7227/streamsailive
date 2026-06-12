/**
 * video-runtime/providers/fal.ts
 * Transport only. Accepts normalized payload, returns normalized result.
 * No model selection. No DB writes. No artifact logic.
 */

import { FAL_API_KEY } from "@/lib/env";
import type { VoiceProviderSubmitResult } from "../types";





type VoiceProviderStatusResult = {
  provider: "fal";
  providerJobId?: string;
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string | null;
  raw?: unknown;
  error?: string;
};

type VoiceMode = string;


type FalVoiceClipSpec = {
  prompt: string;
  durationSeconds?: number;
  [key: string]: unknown;
};
type ClipSpec = Record<string, unknown>;
const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 10_000;

// O3 uses "image_url" not "start_image_url" â€” different param name from v3 standard.
// This is a breaking difference confirmed in the person_editing_pipeline_audit.
const KLING_O3_I2V = "fal-ai/kling-video/o3/standard/image-to-video";

function getModelId(model: string | null, mode: VoiceMode): string {
  const m = model ?? "kling-v3";
  if (m === "veo-3.1") {
    return mode === "image_to_video" ? "fal-ai/veo3.1/image-to-video" : "fal-ai/veo3.1";
  }
  if (m === "kling-o3") {
    // O3 T2V not yet confirmed on fal â€” fall through to v3 standard for T2V
    return mode === "image_to_video"
      ? KLING_O3_I2V
      : "fal-ai/kling-video/v3/standard/text-to-video";
  }
  // Default: kling-v3 standard
  return mode === "image_to_video"
    ? "fal-ai/kling-video/v3/standard/image-to-video"
    : "fal-ai/kling-video/v3/standard/text-to-video";
}

function buildBody(
  clip: FalVoiceClipSpec,
  mode: VoiceMode,
  aspectRatio: string,
): Record<string, unknown> {
  const duration = String(Math.min(Math.max(clip.durationSeconds ?? 5, 3), 15));
  const body: Record<string, unknown> = {
    prompt: clip.prompt,
    duration,
    aspect_ratio: aspectRatio,
    generate_audio: true,
    negative_prompt: "blur, distort, low quality",
    cfg_scale: 0.5,
  };
  if (mode === "image_to_video" && clip.referenceImageUrl) {
    // Kling O3 uses "image_url". Kling v3 standard uses "start_image_url".
    // The model string is not available here (buildBody has no model param).
    // The caller (submitFalVideo) passes model â€” thread it through for O3 detection.
    // For now: both params set; fal ignores unknown params safely.
    // TODO: pass model into buildBody and conditionally set one param only.
    body.start_image_url = clip.referenceImageUrl; // kling-v3 standard
    body.image_url       = clip.referenceImageUrl; // kling-o3
  }
  return body;
}

export async function submitFalVideo(args: {
  clip: ClipSpec;
  model: string | null;
  mode: VoiceMode;
  aspectRatio: string;
}): Promise<VoiceProviderSubmitResult> {
  const apiKey = FAL_API_KEY;
  if (!apiKey) {
    return { accepted: false, provider: "fal", providerJobId: null, status: "failed", raw: "FAL_API_KEY not set" };
  }

  const modelId = getModelId(args.model, args.mode);
  const body = buildBody(args.clip, args.mode, args.aspectRatio);

  try {
    const res = await fetch("https://queue.fal.run/" + modelId, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Key " + apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      return { accepted: false, provider: "fal", providerJobId: null, status: "failed", raw: err };
    }

    const data = await res.json() as { request_id?: string; response_url?: string };
    const providerJobId = data.response_url ?? data.request_id ?? null;
    return { accepted: true, provider: "fal", providerJobId, status: "queued", raw: data };
  } catch (err) {
    return { accepted: false, provider: "fal", providerJobId: null, status: "failed", raw: err instanceof Error ? err.message : String(err) };
  }
}

export async function pollFalVideo(
  providerJobId: string,
): Promise<VoiceProviderStatusResult> {
  const apiKey = FAL_API_KEY;
  if (!apiKey) {
    return { provider: "fal", providerJobId, status: "failed", raw: "FAL_API_KEY not set" };
  }

  // providerJobId is the response_url for fal.ai
  const responseUrl = providerJobId.startsWith("fal_queue:")
    ? providerJobId.slice("fal_queue:".length)
    : providerJobId;

  try {
    const statusRes = await fetch(responseUrl + "/status", {
      headers: { Authorization: "Key " + apiKey },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (!statusRes.ok) {
      return { provider: "fal", providerJobId, status: "processing", raw: null };
    }

    const statusData = await statusRes.json() as { status: string };
    if (statusData.status === "FAILED") {
      return { provider: "fal", providerJobId, status: "failed", raw: statusData };
    }
    if (statusData.status !== "COMPLETED") {
      return { provider: "fal", providerJobId, status: "processing", raw: statusData };
    }

    const resultRes = await fetch(responseUrl, {
      headers: { Authorization: "Key " + apiKey },
    });
    if (!resultRes.ok) {
      return { provider: "fal", providerJobId, status: "failed", raw: null };
    }

    const result = await resultRes.json() as { video?: { url?: string } };
    const outputUrl = result.video?.url ?? null;
    return { provider: "fal", providerJobId, status: outputUrl ? "completed" : "failed", outputUrl, raw: result };
  } catch (err) {
    return { provider: "fal", providerJobId, status: "processing", raw: err instanceof Error ? err.message : String(err) };
  }
}





