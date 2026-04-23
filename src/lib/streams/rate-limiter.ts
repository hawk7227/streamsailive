/**
 * src/lib/streams/rate-limiter.ts
 *
 * In-memory sliding-window rate limiter for the Streams generation routes.
 * Server-side only — runs in Next.js route handlers.
 *
 * Limits per workspace:
 *   - 10 generation submissions per 60 seconds  (burst protection)
 *   - 50 generation submissions per 3600 seconds (hourly cap)
 *
 * Uses a sliding window (token timestamps), not a fixed counter.
 * Module-level Map survives across requests in the same process.
 */

type Window = { ts: number[] };

const windows = new Map<string, Window>();

const LIMITS: { windowMs: number; max: number }[] = [
  { windowMs: 60_000,   max: 10  },  // 10 per minute
  { windowMs: 3_600_000, max: 50 }, // 50 per hour
];

function prune(w: Window, now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  w.ts = w.ts.filter(t => t > cutoff);
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; reason: string };

export function checkRateLimit(workspaceId: string): RateLimitResult {
  const now = Date.now();
  const key = `streams:${workspaceId}`;
  let w = windows.get(key);
  if (!w) { w = { ts: [] }; windows.set(key, w); }

  for (const limit of LIMITS) {
    prune(w, now, limit.windowMs);
    if (w.ts.length >= limit.max) {
      const oldest     = w.ts[0] ?? now;
      const retryAfter = limit.windowMs - (now - oldest) + 100;
      return {
        allowed:      false,
        retryAfterMs: retryAfter,
        reason:       `Rate limit: ${limit.max} requests per ${limit.windowMs / 1000}s`,
      };
    }
  }

  // Allowed — record this request
  w.ts.push(now);
  // Prune oldest window to prevent unbounded growth
  prune(w, now, LIMITS[LIMITS.length - 1].windowMs);
  return { allowed: true };
}

/** Clean up stale entries periodically (call from a health check or cron). */
export function pruneStale(): void {
  const cutoff = Date.now() - 3_600_000;
  for (const [key, w] of windows.entries()) {
    if (!w.ts.some(t => t > cutoff)) windows.delete(key);
  }
}
