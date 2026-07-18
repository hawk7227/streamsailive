export const STREAMS_RESUMABLE_UPLOAD_LIMITS = {
  maxUploadBytes: 64 * 1024 * 1024,
  minChunkBytes: 64 * 1024,
  maxChunkBytes: 8 * 1024 * 1024,
} as const;

function versionParts(value?: string | null) {
  return String(value || "0").split(/[.+-]/).slice(0, 4).map((part) => Number(part.replace(/\D/g, "")) || 0);
}

export function compareVersions(left?: string | null, right?: string | null) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function rolloutBucketFromBytes(bytes: Uint8Array) {
  if (bytes.length < 4) throw new Error("A rollout digest requires at least four bytes");
  const value = (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
  return value % 100;
}

export function stableFallbackRolloutBucket(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}
