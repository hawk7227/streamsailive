export interface StreamsBuilderRateLimitResult {
  ok: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterMs: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkStreamsBuilderRateLimit(input: { key: string; limit?: number; windowMs?: number }): StreamsBuilderRateLimitResult {
  const limit = input.limit ?? 30;
  const windowMs = input.windowMs ?? 60_000;
  const now = Date.now();
  const current = buckets.get(input.key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return { ok: true, key: input.key, limit, remaining: limit - 1, resetAt: new Date(resetAt).toISOString(), retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return { ok: false, key: input.key, limit, remaining: 0, resetAt: new Date(current.resetAt).toISOString(), retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  buckets.set(input.key, current);
  return { ok: true, key: input.key, limit, remaining: Math.max(0, limit - current.count), resetAt: new Date(current.resetAt).toISOString(), retryAfterMs: 0 };
}

export function clearStreamsBuilderRateLimits() {
  buckets.clear();
}
