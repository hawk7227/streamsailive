/**
 * src/lib/streams/provider-keys.ts
 *
 * Client-side provider key store.
 * Keys are written to sessionStorage when the user saves them in SettingsTab.
 * All direct provider calls read from here — no Vercel hop needed.
 *
 * sessionStorage scope: one browser tab session.
 * Keys are cleared when the tab closes — never persisted to disk.
 *
 * Keys stored:
 *   streams:fal_key         — fal.ai API key
 *   streams:elevenlabs_key  — ElevenLabs API key
 *   streams:openai_key      — OpenAI API key
 */

const KEYS = {
  fal:         "streams:fal_key",
  elevenlabs:  "streams:elevenlabs_key",
  openai:      "streams:openai_key",
} as const;

type Provider = keyof typeof KEYS;

export function setProviderKey(provider: Provider, key: string): void {
  try {
    if (key.trim()) {
      sessionStorage.setItem(KEYS[provider], key.trim());
    } else {
      sessionStorage.removeItem(KEYS[provider]);
    }
  } catch { /* SSR or private mode — ignore */ }
}

export function getProviderKey(provider: Provider): string | null {
  try {
    return sessionStorage.getItem(KEYS[provider]) || null;
  } catch {
    return null;
  }
}

export function clearProviderKey(provider: Provider): void {
  try { sessionStorage.removeItem(KEYS[provider]); } catch { /* ignore */ }
}

export function hasProviderKey(provider: Provider): boolean {
  return !!getProviderKey(provider);
}
