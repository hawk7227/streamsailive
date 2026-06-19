/**
 * video-runtime/providers/fal.ts
 * Transport only. Accepts normalized payload, returns normalized result.
 * No model selection. No DB writes. No artifact logic.
 */

import { FAL_API_KEY } from "@/lib/env";
import type { ClipSpec, VideoProviderSubmitResult, VideoProviderStatusResult, VideoMode } from "../types";

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 10_000;
const KLING_O3_I2V = "fal-ai/kling-video/o3/standard/image-to-video";

function getModelId(model: string | null, mode: VideoMode): string {
  const m = model ?? "kling-v2.1-pro";

  if (m === "veo-3.1") {
    return mode === "image_to_video" ? "fal-ai/veo3.1/image-to-video" : "fal-ai/veo3.1";
  }

  if (m === "kling-v2.1-pro" || m === "kling-2.1-pro" || m === "kling-video/v2.1/pro") {
    return mode === "image_to_video"
      ? "fal-ai/kling-video/v2.1/pro/image-to-video"
      : "fal-ai/kling-video/v2.1/pro/text-to-video";
  }

  if (m === "kling-o3") {
    return mode === "image_to_video"
      ? KLING_O3_I2V
      : "fal-ai/kling-video/v3/standard/text-to-video";
  }

  return mode === "image_to_video"
    ? "fal-ai/kling-video/v3/standard/image-to-video"
    : "fal-ai/kling-video/v3/standard/text-to-video";
}

function buildBody(
  clip: ClipSpec,
  mode: VideoMode,
  aspectRatio: string,
  model: string | null,
): Record<string, unknown> {
  const duration = String(Math.min(Math.max(clip.durationSeconds, 3), 10));
  const body: Record<string, unknown> = {
    prompt: clip.prompt,
    duration,
    aspect_ratio: aspectRatio,
    generate_audio: true,
    negative_prompt: "blur, distort, low quality, warped hands, warped face, unreadable text, watermark, logo",
    cfg_scale: 0.5,
  };

  if (mode === "image_to_video" && clip.referenceImageUrl) {
    if (model === "kling-o3") {
      body.image_url = clip.referenceImageUrl;
    } else if (model === "kling-v2.1-pro" || model === "kling-2.1-pro" || model === "kling-video/v2.1/pro") {
      body.image_url = clip.referenceImageUrl;
    } else {
      body.start_image_url = clip.referenceImageUrl;
      body.image_url = clip.referenceImageUrl;
    }
  }

  return body;
}

export async function submitFalVideo(args: {
  clip: ClipSpec;
  model: string | null;
  mode: VideoMode;
  aspectRatio: string;
}): Promise<VideoProviderSubmitResult> {
  const apiKey = FAL_API_KEY;
  if (!apiKey) {
    return { accepted: false, provider: "fal", providerJobId: null, status: "failed", raw: "FAL_API_KEY not set" };
  }

  const modelId = getModelId(args.model, args.mode);
  const body = buildBody(args.clip, args.mode, args.aspectRatio, args.model);

  try {
    const res = await fetch("https://queue.fal.run/" + modelId, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Key " + apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      return { accepted: false, provider: "fal", providerJobId: null, status: "failed", raw: { modelId, body, error: err } };
    }

    const data = await res.json() as { request_id?: string; response_url?: string };
    const providerJobId = data.response_url ?? data.request_id ?? null;
    return { accepted: true, provider: "fal", providerJobId, status: "queued", raw: { modelId, body, response: data } };
  } catch (err) {
    return { accepted: false, provider: "fal", providerJobId: null, status: "failed", raw: { modelId, body, error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function pollFalVideo(
  providerJobId: string,
): Promise<VideoProviderStatusResult> {
  const apiKey = FAL_API_KEY;
  if (!apiKey) {
    return { provider: "fal", providerJobId, status: "failed", raw: "FAL_API_KEY not set" };
  }

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
