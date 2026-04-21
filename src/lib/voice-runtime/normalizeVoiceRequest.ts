import type { GenerateVoiceInput, NormalizedVoiceRequest, VoiceSegment } from "./types";

const DEFAULT_VOICE = "jqcCZkN6Knx8BJ5TBdYR"; // ElevenLabs default
const DEFAULT_PROVIDER = "elevenlabs";
const MAX_TEXT_CHARS = 5000;

export function normalizeVoiceRequest(input: GenerateVoiceInput): NormalizedVoiceRequest {
  const text = input.text?.trim() ?? "";
  const segments: VoiceSegment[] = input.segments?.length
    ? input.segments.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text)
    : [];

  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    voice: input.voice?.trim() || DEFAULT_VOICE,
    style: input.style?.trim() || undefined,
    emotion: input.emotion?.trim() || undefined,
    speed: typeof input.speed === "number" && input.speed > 0 ? Math.min(Math.max(input.speed, 0.5), 2.0) : 1.0,
    referenceAudioUrl: input.referenceAudioUrl?.trim() || undefined,
    language: input.language?.trim() || "en",
    format: input.format === "wav" ? "wav" : "mp3",
    workspaceId: input.workspaceId?.trim() || "assistant-core",
    provider: input.provider?.trim() || DEFAULT_PROVIDER,
    model: input.model?.trim() || null,
    segments,
    isMultiSegment: segments.length > 1,
  };
}
