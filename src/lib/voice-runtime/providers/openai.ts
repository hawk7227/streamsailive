import { OPENAI_API_KEY } from "@/lib/env";
import type { VoiceProviderSubmitResult } from "../types";
const TIMEOUT_MS = 30_000;
export async function submitOpenAIVoice(args: { text: string; voice: string; model: string | null; speed: number }): Promise<VoiceProviderSubmitResult> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return { accepted: false, provider: "openai", status: "failed", mimeType: "audio/mpeg", raw: "OPENAI_API_KEY not set" };
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: args.model || "tts-1-hd", input: args.text.slice(0, 4096), voice: args.voice || "alloy", speed: args.speed }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { accepted: false, provider: "openai", status: "failed", mimeType: "audio/mpeg", raw: res.statusText };
    const audio = Buffer.from(await res.arrayBuffer());
    return { accepted: true, provider: "openai", audio, status: "completed", mimeType: "audio/mpeg", raw: null };
  } catch (err) {
    return { accepted: false, provider: "openai", status: "failed", mimeType: "audio/mpeg", raw: err instanceof Error ? err.message : String(err) };
  }
}
