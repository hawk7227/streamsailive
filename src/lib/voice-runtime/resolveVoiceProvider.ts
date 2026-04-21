import type { NormalizedVoiceRequest } from "./types";

export function resolveVoiceProvider(req: NormalizedVoiceRequest): { provider: string; model: string | null } {
  const p = req.provider.toLowerCase();
  if (p === "openai") return { provider: "openai", model: req.model || "tts-1-hd" };
  return { provider: "elevenlabs", model: req.model || "eleven_turbo_v2_5" };
}
