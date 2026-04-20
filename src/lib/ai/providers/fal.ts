import { AIProvider, GenerationOptions, GenerationResult, GenerationType } from '../types';
import { FAL_API_KEY } from "@/lib/env";

// ── fal.ai Model Registry ────────────────────────────────────────────────────
// Images:  Seedream Lite v5, Nano Banana 2
// Videos:  Kling v3 (Standard), Veo 3.1

export const FAL_IMAGE_MODELS = {
  'seedream-lite-v5': {
    id: 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
    label: 'Seedream Lite v5',
    costPerImage: 0.035,
  },
  'nano-banana-2': {
    id: 'fal-ai/nano-banana-2',
    label: 'Nano Banana 2',
    costPerImage: 0.08,
  },
} as const;

export const FAL_VIDEO_MODELS = {
  'kling-v3': {
    t2v: 'fal-ai/kling-video/v3/standard/text-to-video',
    i2v: 'fal-ai/kling-video/v3/standard/image-to-video',
    label: 'Kling v3',
    costPerSecond: 0.084,
  },
  'veo-3.1': {
    t2v: 'fal-ai/veo3.1',
    i2v: 'fal-ai/veo3.1/image-to-video',
    label: 'Veo 3.1',
    costPerSecond: 0.20,
  },
} as const;

export type FalImageModelKey = keyof typeof FAL_IMAGE_MODELS;
export type FalVideoModelKey = keyof typeof FAL_VIDEO_MODELS;

const DEFAULT_IMAGE_MODEL: FalImageModelKey = 'seedream-lite-v5';
const DEFAULT_VIDEO_MODEL: FalVideoModelKey = 'kling-v3';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = FAL_API_KEY;
  if (!key) throw new Error('FAL_API_KEY is not set');
  return key;
}

/** Sync request — used for fast image generation (completes in seconds). */
async function falRequest<T>(modelId: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(`fal.ai request failed (${res.status}): ${err.detail ?? res.statusText}`);
  }

  return res.json() as Promise<T>;
}

interface FalQueueResponse {
  request_id: string;
  status_url: string;
  response_url: string;
}

/**
 * Submit to fal.ai queue — returns the response_url directly.
 * fal.ai uses shortened model paths in status/response URLs, so we store
 * the full response_url rather than reconstructing it from the model ID.
 *
 * external_id format: "fal_queue:{response_url}"
 */
export async function falQueueSubmit(modelId: string, body: Record<string, unknown>): Promise<{ requestId: string; responseUrl: string }> {
  const apiKey = getApiKey();

  const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.json().catch(() => ({})) as { detail?: string };
    throw new Error(`fal.ai queue submit failed (${submitRes.status}): ${err.detail ?? submitRes.statusText}`);
  }

  const data = await submitRes.json() as FalQueueResponse;
  return { requestId: data.request_id, responseUrl: data.response_url };
}

/**
 * Poll a fal.ai queue request — called by the cron poller, NOT the API route.
 * Uses the response_url directly (stored in external_id as "fal_queue:{url}").
 */
export async function falQueuePoll(responseUrl: string): Promise<{ status: 'completed'; videoUrl: string } | { status: 'processing' } | { status: 'failed' }> {
  const apiKey = getApiKey();

  // Check status
  const statusRes = await fetch(
    `${responseUrl}/status`,
    {
      headers: { 'Authorization': `Key ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!statusRes.ok) return { status: 'processing' };

  const statusData = await statusRes.json() as { status: string };

  if (statusData.status === 'FAILED') return { status: 'failed' };
  if (statusData.status !== 'COMPLETED') return { status: 'processing' };

  // Fetch the completed result
  const resultRes = await fetch(
    responseUrl,
    { headers: { 'Authorization': `Key ${apiKey}` } }
  );

  if (!resultRes.ok) return { status: 'failed' };

  const result = await resultRes.json() as { video?: { url: string } };
  if (!result.video?.url) return { status: 'failed' };

  return { status: 'completed', videoUrl: result.video.url };
}

// ── Aspect ratio → image size mapping ────────────────────────────────────────

function getImageSizeForSeedream(aspectRatio?: string): string {
  switch (aspectRatio) {
    case '9:16': return 'portrait_16_9';
    case '16:9': return 'landscape_16_9';
    case '4:3': return 'landscape_4_3';
    case '3:4': return 'portrait_4_3';
    case '1:1': return 'square_hd';
    default: return 'landscape_16_9';
  }
}

function getNanaBananaAspectRatio(aspectRatio?: string): string {
  switch (aspectRatio) {
    case '9:16': return '9:16';
    case '16:9': return '16:9';
    case '4:3': return '4:3';
    case '3:4': return '3:4';
    case '1:1': return '1:1';
    default: return '16:9';
  }
}

function getResolutionFromQuality(quality?: string): string {
  if (!quality) return '1K';
  const q = quality.toLowerCase();
  if (q.includes('4k')) return '4K';
  if (q.includes('2k')) return '2K';
  if (q.includes('1080')) return '2K';
  return '1K';
}

// ── Provider Implementation ──────────────────────────────────────────────────

interface FalImageResponse {
  images?: { url: string }[];
}

export class FalProvider implements AIProvider {
  async generate(type: GenerationType, options: GenerationOptions): Promise<GenerationResult> {
    switch (type) {
      case 'image': return this.generateImage(options);
      case 'video': return this.generateVideo(options);
      case 'i2v':   return this.generateI2V(options);
      default:
        throw new Error(`FalProvider does not support type: ${type}`);
    }
  }

  // ── Image Generation (sync — completes in seconds) ───────────────────────

  private async generateImage(options: GenerationOptions): Promise<GenerationResult> {
    const modelKey = (options.model as FalImageModelKey) || DEFAULT_IMAGE_MODEL;
    const modelDef = FAL_IMAGE_MODELS[modelKey];

    if (!modelDef) {
      throw new Error(`Unknown fal image model: ${modelKey}`);
    }

    let result: FalImageResponse;

    if (modelKey === 'seedream-lite-v5') {
      result = await falRequest<FalImageResponse>(modelDef.id, {
        prompt: options.prompt,
        image_size: getImageSizeForSeedream(options.aspectRatio),
        num_images: 1,
        enable_safety_checker: true,
      });
    } else {
      // nano-banana-2
      result = await falRequest<FalImageResponse>(modelDef.id, {
        prompt: options.prompt,
        aspect_ratio: getNanaBananaAspectRatio(options.aspectRatio),
        resolution: getResolutionFromQuality(options.quality),
        num_images: 1,
        output_format: 'png',
        safety_tolerance: '4',
      });
    }

    const url = result.images?.[0]?.url;
    if (!url) return { status: 'failed' };

    return {
      status: 'completed',
      outputUrl: url,
      costEstimate: modelDef.costPerImage,
    };
  }

  // ── Text-to-Video (async — submits to queue, returns pending) ────────────

  private async generateVideo(options: GenerationOptions): Promise<GenerationResult> {
    const modelKey = (options.model as FalVideoModelKey) || DEFAULT_VIDEO_MODEL;
    const modelDef = FAL_VIDEO_MODELS[modelKey];

    if (!modelDef) {
      throw new Error(`Unknown fal video model: ${modelKey}`);
    }

    const modelId = modelDef.t2v;
    const body = modelKey === 'kling-v3'
      ? this.buildKlingBody(options)
      : this.buildVeoBody(options);

    const { responseUrl } = await falQueueSubmit(modelId, body);

    const durationNum = parseDuration(options.duration);
    return {
      status: 'pending',
      externalId: `fal_queue:${responseUrl}`,
      costEstimate: modelDef.costPerSecond * durationNum,
    };
  }

  // ── Image-to-Video (async — submits to queue, returns pending) ───────────

  private async generateI2V(options: GenerationOptions): Promise<GenerationResult> {
    if (!options.imageUrl) {
      throw new Error('imageUrl is required for image-to-video generation');
    }

    const modelKey = (options.model as FalVideoModelKey) || DEFAULT_VIDEO_MODEL;
    const modelDef = FAL_VIDEO_MODELS[modelKey];

    if (!modelDef) {
      throw new Error(`Unknown fal video model: ${modelKey}`);
    }

    const modelId = modelDef.i2v;
    const body = modelKey === 'kling-v3'
      ? this.buildKlingBody(options, true)
      : this.buildVeoBody(options, true);

    const { responseUrl } = await falQueueSubmit(modelId, body);

    const durationNum = parseDuration(options.duration);
    return {
      status: 'pending',
      externalId: `fal_queue:${responseUrl}`,
      costEstimate: modelDef.costPerSecond * durationNum,
    };
  }

  // ── Payload Builders ─────────────────────────────────────────────────────

  private buildKlingBody(options: GenerationOptions, isI2V = false): Record<string, unknown> {
    const durationNum = parseDuration(options.duration);
    const klingDuration = String(Math.min(Math.max(durationNum, 3), 15));

    const aspectRatio = options.aspectRatio === '9:16' ? '9:16'
      : options.aspectRatio === '1:1' ? '1:1'
      : '16:9';

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      duration: klingDuration,
      aspect_ratio: aspectRatio,
      generate_audio: true,
      negative_prompt: 'blur, distort, and low quality',
      cfg_scale: 0.5,
    };

    if (isI2V && options.imageUrl) {
      body.start_image_url = options.imageUrl;
    }

    return body;
  }

  private buildVeoBody(options: GenerationOptions, isI2V = false): Record<string, unknown> {
    const durationNum = parseDuration(options.duration);
    const veoDuration = durationNum <= 4 ? '4s' : durationNum <= 6 ? '6s' : '8s';

    const aspectRatio = options.aspectRatio === '9:16' ? '9:16' : '16:9';

    const resolution = options.quality?.toLowerCase().includes('4k') ? '4k'
      : options.quality?.toLowerCase().includes('1080') ? '1080p'
      : '720p';

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      duration: veoDuration,
      aspect_ratio: isI2V ? 'auto' : aspectRatio,
      resolution,
      generate_audio: true,
      safety_tolerance: '4',
      auto_fix: true,
    };

    if (isI2V && options.imageUrl) {
      body.image_url = options.imageUrl;
    }

    return body;
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function parseDuration(duration?: string): number {
  if (!duration) return 5;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 5;
}
