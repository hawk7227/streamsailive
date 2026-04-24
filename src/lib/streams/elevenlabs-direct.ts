/**
 * src/lib/streams/elevenlabs-direct.ts
 *
 * Direct browser → ElevenLabs. No Vercel hop.
 * Reads elevenlabs key from sessionStorage (set by SettingsTab on save).
 *
 * ElevenLabs browser integration:
 *   REST API: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 *   Returns: audio/mpeg binary → play via Audio or create blob URL
 *   Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
 *
 * Default voice: Rachel (21m00Tcm4TlvDq8ikWAM) — change in Settings
 */

import { getProviderKey } from "./provider-keys";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export interface ElevenLabsTTSOptions {
  text:      string;
  voiceId?:  string;
  modelId?:  string;   // eleven_multilingual_v2 | eleven_turbo_v2_5 | eleven_flash_v2_5
  stability?:          number; // 0-1
  similarityBoost?:    number; // 0-1
  onDone:    (audioUrl: string) => void;
  onError:   (err: string) => void;
}

export async function speakDirectFromElevenLabs(opts: ElevenLabsTTSOptions): Promise<void> {
  const key = getProviderKey("elevenlabs");
  if (!key) {
    opts.onError("ElevenLabs key not set — go to Settings → API Keys and add your ElevenLabs key.");
    return;
  }

  const voiceId = opts.voiceId ?? DEFAULT_VOICE_ID;
  const modelId = opts.modelId ?? "eleven_turbo_v2_5"; // fastest model

  try {
    const res = await fetch(
      `${ELEVENLABS_BASE}/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept":        "audio/mpeg",
          "Content-Type":  "application/json",
          "xi-api-key":    key,
        },
        body: JSON.stringify({
          text:             opts.text,
          model_id:         modelId,
          voice_settings: {
            stability:        opts.stability        ?? 0.5,
            similarity_boost: opts.similarityBoost  ?? 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`);
      opts.onError(`ElevenLabs error ${res.status}: ${err.slice(0, 200)}`);
      return;
    }

    const blob   = await res.blob();
    const url    = URL.createObjectURL(blob);
    opts.onDone(url);
  } catch (err) {
    opts.onError(err instanceof Error ? err.message : "ElevenLabs request failed");
  }
}

// ── List available voices ─────────────────────────────────────────────────────
export interface ElevenLabsVoice {
  voice_id: string;
  name:     string;
  category: string;
}

export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const key = getProviderKey("elevenlabs");
  if (!key) return [];
  try {
    const res = await fetch(`${ELEVENLABS_BASE}/v1/voices`, {
      headers: { "xi-api-key": key },
    });
    if (!res.ok) return [];
    const data = await res.json() as { voices?: ElevenLabsVoice[] };
    return data.voices ?? [];
  } catch { return []; }
}

// ── Validate key ──────────────────────────────────────────────────────────────
export async function validateElevenLabsKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${ELEVENLABS_BASE}/v1/user`, {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch { return false; }
}
