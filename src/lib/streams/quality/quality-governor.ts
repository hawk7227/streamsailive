export type MediaKind = "image" | "video" | "audio";

export interface ProviderCapability {
  provider: string;
  model: string;
  mediaType: MediaKind;
  supportsExactDimensions: boolean;
  supportsBulk: boolean;
  supportsImg2Img: boolean;
  supportsInpaint: boolean;
  supportsOutpaint: boolean;
  supportsUpscale: boolean;
  supportedAspectRatios: string[];
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  realismTier: number;
  promptAdherenceTier: number;
  speedTier: number;
  costTier: number;
}

export interface QualityRequest {
  mediaType: MediaKind;
  prompt: string;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string | null;
  bulkCount?: number | null;
  requiresRealism?: boolean;
  requiresImg2Img?: boolean;
  requiresInpaint?: boolean;
  requiresOutpaint?: boolean;
  requiresUpscale?: boolean;
}

export interface QualityRoutingDecision {
  provider: string;
  model: string;
  reason: string;
  nativeExactSize: boolean;
}

export function chooseProviderForQuality(
  request: QualityRequest,
  capabilities: ProviderCapability[],
): QualityRoutingDecision | null {
  const exactSizeRequired = Boolean(request.width && request.height);

  const eligible = capabilities
    .filter((c) => c.mediaType === request.mediaType)
    .filter((c) => {
      if (exactSizeRequired) {
        if (!c.supportsExactDimensions) return false;
        if (c.minWidth && request.width! < c.minWidth) return false;
        if (c.maxWidth && request.width! > c.maxWidth) return false;
        if (c.minHeight && request.height! < c.minHeight) return false;
        if (c.maxHeight && request.height! > c.maxHeight) return false;
      }

      if (!exactSizeRequired && request.aspectRatio && c.supportedAspectRatios.length > 0) {
        if (!c.supportedAspectRatios.includes(request.aspectRatio)) return false;
      }

      if ((request.bulkCount ?? 1) > 1 && !c.supportsBulk) return false;
      if (request.requiresImg2Img && !c.supportsImg2Img) return false;
      if (request.requiresInpaint && !c.supportsInpaint) return false;
      if (request.requiresOutpaint && !c.supportsOutpaint) return false;
      if (request.requiresUpscale && !c.supportsUpscale) return false;

      return true;
    })
    .sort((a, b) => {
      const realismWeight = request.requiresRealism ? 3 : 1;
      const aScore = a.realismTier * realismWeight + a.promptAdherenceTier * 2 - a.costTier * 0.25;
      const bScore = b.realismTier * realismWeight + b.promptAdherenceTier * 2 - b.costTier * 0.25;
      return bScore - aScore;
    });

  const selected = eligible[0];
  if (!selected) return null;

  return {
    provider: selected.provider,
    model: selected.model,
    nativeExactSize: exactSizeRequired,
    reason: exactSizeRequired
      ? "selected provider because it supports native exact dimensions"
      : "selected provider by quality capability score",
  };
}

export function compileImagePrompt(input: {
  prompt: string;
  realism?: boolean;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string | null;
}): string {
  const parts = [
    "Create a premium, production-quality image.",
    input.realism ? "Maintain a realistic photographic style with natural lighting, believable anatomy, clean skin texture, and professional composition." : null,
    input.width && input.height
      ? `Generate natively at exactly ${input.width}x${input.height}. Do not crop, pad, stretch, or simulate this size after generation.`
      : input.aspectRatio
        ? `Use native aspect ratio ${input.aspectRatio}.`
        : null,
    "Avoid artifacts, distorted faces, bad hands, warped anatomy, low-resolution details, unwanted text, watermarks, and cheap stock-photo styling.",
    `User request: ${input.prompt}`,
  ];

  return parts.filter(Boolean).join("\n");
}
