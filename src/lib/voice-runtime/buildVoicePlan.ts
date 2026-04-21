import type { NormalizedVoiceRequest, VoicePlan } from "./types";

export function buildVoicePlan(req: NormalizedVoiceRequest): VoicePlan {
  return {
    provider: req.provider,
    model: req.model,
    voice: req.voice,
    text: req.text,
    speed: req.speed,
    format: req.format,
    segments: req.segments,
    isMultiSegment: req.isMultiSegment,
    generateTranscript: req.isMultiSegment,
  };
}
