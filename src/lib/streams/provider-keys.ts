/**
 * src/lib/streams/provider-keys.ts
 *
 * Client-side provider key store.
 * Uses localStorage — persists across page reloads and browser restarts.
 * Keys are scoped to the user's own browser — never sent to any server.
 *
 * Changed from sessionStorage → localStorage so keys survive page refreshes.
 */

const KEYS = {
  fal:         "streams:fal_key",
  elevenlabs:  "streams:elevenlabs_key",
  openai:      "streams:openai_key",
  runway:      "streams:runway_key",
} as const;

export type Provider = keyof typeof KEYS;

export function setProviderKey(provider: Provider, key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(KEYS[provider], key.trim());
    } else {
      localStorage.removeItem(KEYS[provider]);
    }
  } catch { /* SSR or private mode — ignore */ }
}

export function getProviderKey(provider: Provider): string | null {
  try {
    return localStorage.getItem(KEYS[provider]) || null;
  } catch {
    return null;
  }
}

export function clearProviderKey(provider: Provider): void {
  try { localStorage.removeItem(KEYS[provider]); } catch { /* ignore */ }
}

export function hasProviderKey(provider: Provider): boolean {
  return !!getProviderKey(provider);
}
