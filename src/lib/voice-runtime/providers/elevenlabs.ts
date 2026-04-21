import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from "@/lib/env";
import type { VoiceProviderSubmitResult } from "../types";
const TIMEOUT_MS = 30_000;
export async function submitElevenLabsVoice(args: { text: string; voice: string; model: string | null; speed: number }): Promise<VoiceProviderSubmitResult> {
  const apiKey = ELEVENLABS_API_KEY;
  if (!apiKey) return { accepted: false, provider: "elevenlabs", status: "failed", mimeType: "audio/mpeg", raw: "ELEVENLABS_API_KEY not set" };
  const voiceId = args.voice || ELEVENLABS_VOICE_ID || "jqcCZkN6Knx8BJ5TBdYR";
  const model = args.model || "eleven_turbo_v2_5";
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: args.text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: args.speed } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) { const err = await res.text(); return { accepted: false, provider: "elevenlabs", status: "failed", mimeType: "audio/mpeg", raw: err }; }
    const audio = Buffer.from(await res.arrayBuffer());
    return { accepted: true, provider: "elevenlabs", audio, status: "completed", mimeType: "audio/mpeg", raw: null };
  } catch (err) {
    return { accepted: false, provider: "elevenlabs", status: "failed", mimeType: "audio/mpeg", raw: err instanceof Error ? err.message : String(err) };
  }
}
