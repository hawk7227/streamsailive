import { ASPECT_RATIO_TO_SIZE, getVideoMotionPolicy } from "./realismPolicy";
import type { AspectRatio, GeneratedImageCandidate, VideoCandidate } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function generateImageCandidatesFromProvider(params: {
  prompt: string;
  aspectRatio: AspectRatio;
  attempts: number;
}): Promise<GeneratedImageCandidate[]> {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const size = ASPECT_RATIO_TO_SIZE[params.aspectRatio];
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: params.prompt,
      size,
      quality: "standard",
      n: params.attempts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  return (payload.data ?? []).map((item, index) => ({
    id: `img-${Date.now()}-${index}`,
    url: item.url ?? `data:image/png;base64,${item.b64_json}`,
    promptUsed: params.prompt,
    attempt: index + 1,
    ocrText: [],
    metadata: {},
  }));
}

export async function generateVideoCandidatesFromProvider(params: {
  sourceImageUrl: string;
  attempts: number;
}): Promise<VideoCandidate[]> {
  const motionPolicy = getVideoMotionPolicy();
  return Array.from({ length: params.attempts }).map((_, index) => ({
    id: `vid-${Date.now()}-${index}`,
    url: params.sourceImageUrl,
    sourceImageUrl: params.sourceImageUrl,
    promptUsed: `Animate approved image with policy ${JSON.stringify(motionPolicy)}`,
    attempt: index + 1,
  }));
}
