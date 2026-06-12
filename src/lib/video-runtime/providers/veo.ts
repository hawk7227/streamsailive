/**
 * video-runtime/providers/veo.ts
 * Transport only. Normalized submit + poll for a direct Veo provider endpoint.
 *
 * This adapter intentionally does not invent a fake Google/Veo API contract.
 * Configure VEO_GENERATION_ENDPOINT and optionally VEO_STATUS_ENDPOINT for the
 * production Veo gateway you use. The adapter also accepts common response
 * shapes from provider gateways and returns normalized providerJobId/outputUrl.
 */

import { VEO_API_KEY, VEO_GENERATION_ENDPOINT, VEO_STATUS_ENDPOINT } from "@/lib/env";
import type { ClipSpec, VideoProviderSubmitResult, VideoProviderStatusResult, VideoMode } from "../types";

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 10_000;

type AnyRecord = Record<string, any>;

function extractJobId(data: AnyRecord): string | null {
  return data?.id || data?.taskId || data?.jobId || data?.operationId || data?.name || data?.request_id || null;
}

function extractOutputUrl(data: AnyRecord): string | null {
  return (
    data?.outputUrl ||
    data?.videoUrl ||
    data?.url ||
    data?.asset?.url ||
    data?.video?.url ||
    data?.response?.videoUrl ||
    data?.result?.videoUrl ||
    data?.result?.outputUrl ||
    data?.response?.generatedVideos?.[0]?.video?.uri ||
    data?.generatedVideos?.[0]?.video?.uri ||
    null
  );
}

function normalizeStatus(data: AnyRecord): VideoProviderStatusResult["status"] {
  const value = String(data?.status || data?.state || data?.done || data?.operationStatus || "").toLowerCase();
  if (value === "true" || value === "done" || value === "completed" || value === "succeeded" || value === "success") return "completed";
  if (value === "failed" || value === "error" || value === "cancelled") return "failed";
  return "processing";
}

export async function submitVeoVideo(args: {
  clip: ClipSpec;
  model: string | null;
  mode: VideoMode;
  aspectRatio: string;
}): Promise<VideoProviderSubmitResult> {
  const apiKey = VEO_API_KEY;
  const endpoint = VEO_GENERATION_ENDPOINT;
  if (!apiKey) {
    return { accepted: false, provider: "veo", providerJobId: null, status: "failed", raw: "VEO_API_KEY not set" };
  }
  if (!endpoint) {
    return {
      accepted: false,
      provider: "veo",
      providerJobId: null,
      status: "failed",
      raw: "VEO_GENERATION_ENDPOINT not set. Add the production Veo gateway endpoint that accepts VEO_API_KEY.",
    };
  }

  const body: Record<string, unknown> = {
    model: args.model || "veo-3",
    prompt: args.clip.prompt,
    promptText: args.clip.prompt,
    aspectRatio: args.aspectRatio,
    ratio: args.aspectRatio,
    durationSeconds: args.clip.durationSeconds,
    mode: args.mode,
  };
  if (args.mode === "image_to_video" && args.clip.referenceImageUrl) {
    body.image = args.clip.referenceImageUrl;
    body.imageUrl = args.clip.referenceImageUrl;
    body.referenceImageUrl = args.clip.referenceImageUrl;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
    const data = await res.json().catch(async () => ({ text: await res.text().catch(() => res.statusText) })) as AnyRecord;
    if (!res.ok) {
      return { accepted: false, provider: "veo", providerJobId: null, status: "failed", raw: data };
    }
    const outputUrl = extractOutputUrl(data);
    const jobId = extractJobId(data);
    return {
      accepted: true,
      provider: "veo",
      providerJobId: jobId || (outputUrl ? "completed:" + outputUrl : null),
      status: outputUrl ? "completed" : "queued",
      outputUrl,
      raw: data,
    };
  } catch (err) {
    return { accepted: false, provider: "veo", providerJobId: null, status: "failed", raw: err instanceof Error ? err.message : String(err) };
  }
}

export async function pollVeoVideo(providerJobId: string): Promise<VideoProviderStatusResult> {
  const apiKey = VEO_API_KEY;
  if (!apiKey) return { provider: "veo", providerJobId, status: "failed", raw: "VEO_API_KEY not set" };
  if (providerJobId.startsWith("completed:")) {
    const outputUrl = providerJobId.slice("completed:".length);
    return { provider: "veo", providerJobId, status: "completed", outputUrl, raw: { immediate: true } };
  }

  const endpoint = VEO_STATUS_ENDPOINT
    ? VEO_STATUS_ENDPOINT.replace("{id}", encodeURIComponent(providerJobId))
    : null;
  if (!endpoint) {
    return {
      provider: "veo",
      providerJobId,
      status: "processing",
      raw: "VEO_STATUS_ENDPOINT not set. Polling will continue until a configured Veo status endpoint is available.",
    };
  }

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: "Bearer " + apiKey, "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    const data = await res.json().catch(async () => ({ text: await res.text().catch(() => res.statusText) })) as AnyRecord;
    if (!res.ok) return { provider: "veo", providerJobId, status: "processing", raw: data };
    const outputUrl = extractOutputUrl(data);
    const status = outputUrl ? "completed" : normalizeStatus(data);
    return { provider: "veo", providerJobId, status: status === "completed" && !outputUrl ? "processing" : status, outputUrl, raw: data };
  } catch (err) {
    return { provider: "veo", providerJobId, status: "processing", raw: err instanceof Error ? err.message : String(err) };
  }
}
