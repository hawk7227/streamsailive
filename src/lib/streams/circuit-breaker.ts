/**
 * src/lib/streams/circuit-breaker.ts
 *
 * Circuit breaker for fal.ai calls.
 * Prevents cascade failure when fal is degraded.
 *
 * States:
 *   CLOSED  — normal operation, calls pass through
 *   OPEN    — fal is down, fast-fail for OPEN_DURATION_MS
 *   HALF    — trial period, one call allowed through to test recovery
 *
 * Trips after FAILURE_THRESHOLD consecutive failures within WINDOW_MS.
 * Resets after OPEN_DURATION_MS regardless of fal recovery signals.
 */

type BreakerState = "CLOSED" | "OPEN" | "HALF";

interface Breaker {
  state:        BreakerState;
  failures:     number;
  lastFailureAt: number;
  openedAt:     number;
}

const FAILURE_THRESHOLD = 5;
const WINDOW_MS         = 60_000;
const OPEN_DURATION_MS  = 60_000;

// One breaker per fal endpoint group
const breakers = new Map<string, Breaker>();

function getBreaker(key: string): Breaker {
  if (!breakers.has(key)) {
    breakers.set(key, { state: "CLOSED", failures: 0, lastFailureAt: 0, openedAt: 0 });
  }
  return breakers.get(key)!;
}

export type BreakerResult =
  | { open: false }
  | { open: true; retryAfterMs: number };

export function checkBreaker(endpoint: string): BreakerResult {
  // Group by top-level service (fal-ai/kling, fal-ai/elevenlabs, etc.)
  const service = endpoint.split("/").slice(0, 2).join("/");
  const b       = getBreaker(service);
  const now     = Date.now();

  if (b.state === "OPEN") {
    const elapsed = now - b.openedAt;
    if (elapsed >= OPEN_DURATION_MS) {
      b.state = "HALF";
    } else {
      return { open: true, retryAfterMs: OPEN_DURATION_MS - elapsed };
    }
  }

  return { open: false };
}

export function recordSuccess(endpoint: string): void {
  const service = endpoint.split("/").slice(0, 2).join("/");
  const b       = getBreaker(service);
  b.state    = "CLOSED";
  b.failures = 0;
}

export function recordFailure(endpoint: string): void {
  const service = endpoint.split("/").slice(0, 2).join("/");
  const b       = getBreaker(service);
  const now     = Date.now();

  // Reset count if outside failure window
  if (now - b.lastFailureAt > WINDOW_MS) b.failures = 0;

  b.failures++;
  b.lastFailureAt = now;

  if (b.failures >= FAILURE_THRESHOLD && b.state !== "OPEN") {
    b.state    = "OPEN";
    b.openedAt = now;
  }
}
