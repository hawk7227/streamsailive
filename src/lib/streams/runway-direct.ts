/**
 * src/lib/streams/runway-direct.ts
 *
 * Direct browser → Runway Gen4. No Vercel hop.
 * Reads runway key from sessionStorage (set by SettingsTab on save).
 *
 * Runway integration:
 *   SDK:  @runwayml/sdk (Node only — we use REST directly)
 *   REST: POST https://api.runwayml.com/v1/tasks
 *   Docs: https://docs.dev.runwayml.com
 *
 * Key types:
 *   key_*  → api.dev.runwayml.com  (dev/test keys)
 *   other  → api.runwayml.com       (production keys)
 *
 * Flow:
 *   1. POST /v1/tasks          → { id } (task ID)
 *   2. GET  /v1/tasks/{id}     → poll until status = SUCCEEDED | FAILED
 *   3. result.output[0]        → video URL
 */

import { getProviderKey } from "./provider-keys";

const RUNWAY_VERSION = "2024-11-06";

function getRunwayBase(key: string): string {
  return key.startsWith("key_")
    ? "https://api.dev.runwayml.com"
    : "https://api.runwayml.com";
}

export interface RunwayGenerateOptions {
  prompt:       string;
  imageUrl?:    string;    // for I2V
  duration?:    4 | 5 | 8 | 10;
  ratio?:       "1280:720" | "720:1280" | "1104:832" | "832:1104" | "960:960";
  model?:       "gen4_turbo" | "gen4";
  onProgress:   (status: string) => void;
  onDone:       (videoUrl: string) => void;
  onError:      (err: string) => void;
  signal?:      AbortSignal;
  pollMs?:      number;
  maxPolls?:    number;
}

export async function generateDirectFromRunway(opts: RunwayGenerateOptions): Promise<void> {
  const key = getProviderKey("runway");
  if (!key) {
    opts.onError("Runway key not set — go to Settings → API Keys and add your Runway key.");
    return;
  }

  const base    = getRunwayBase(key);
  const headers = {
    "Content-Type":   "application/json",
    "Authorization":  `Bearer ${key}`,
    "X-Runway-Version": RUNWAY_VERSION,
  };

  const pollMs   = opts.pollMs   ?? 5000;
  const maxPolls = opts.maxPolls ?? 60;   // 5 min max

  // ── Step 1: Submit task ───────────────────────────────────────────────────
  let taskId: string;
  try {
    opts.onProgress("Submitting to Runway…");

    const taskBody: Record<string, unknown> = {
      model:        opts.model ?? "gen4_turbo",
      promptText:   opts.prompt,
      duration:     opts.duration ?? 5,
      ratio:        opts.ratio ?? "1280:720",
    };

    if (opts.imageUrl) {
      taskBody.promptImage = [{ uri: opts.imageUrl, position: "first" }];
    }

    const res = await fetch(`${base}/v1/tasks`, {
      method:  "POST",
      headers,
      body:    JSON.stringify(taskBody),
      signal:  opts.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => `HTTP ${res.status}`);
      opts.onError(`Runway submit failed: ${body.slice(0, 200)}`);
      return;
    }

    const data = await res.json() as { id?: string; error?: string };
    if (!data.id) {
      opts.onError(data.error ?? "Runway did not return a task ID");
      return;
    }
    taskId = data.id;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    opts.onError(err instanceof Error ? err.message : "Runway submit failed");
    return;
  }

  // ── Step 2: Poll until complete ───────────────────────────────────────────
  let polls = 0;
  while (polls < maxPolls) {
    if (opts.signal?.aborted) return;
    await new Promise(r => setTimeout(r, pollMs));
    polls++;

    try {
      const res = await fetch(`${base}/v1/tasks/${taskId}`, {
        headers,
        signal: opts.signal,
      });

      if (!res.ok) continue;

      const task = await res.json() as {
        status?: string;
        output?: string[];
        error?:  string;
        progress?: number;
      };

      const status = (task.status ?? "").toUpperCase();

      if (status === "FAILED") {
        opts.onError(task.error ?? "Runway task failed");
        return;
      }

      if (status === "SUCCEEDED") {
        const url = task.output?.[0];
        if (!url) {
          opts.onError("Runway succeeded but no output URL returned");
          return;
        }
        opts.onDone(url);
        return;
      }

      // PENDING | RUNNING | THROTTLED
      const pct = task.progress ? ` ${Math.round(task.progress * 100)}%` : "";
      opts.onProgress(`Runway generating…${pct}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // Poll error — keep trying
    }
  }

  opts.onError("Runway timed out — task may still be running, check your Runway dashboard");
}

// ── Validate key ──────────────────────────────────────────────────────────────
export async function validateRunwayKey(key: string): Promise<boolean> {
  const base = getRunwayBase(key);
  try {
    const res = await fetch(`${base}/v1/tasks`, {
      headers: {
        "Authorization":    `Bearer ${key}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
      signal: AbortSignal.timeout(8000),
    });
    // 401 = invalid key, 200/400/404 = key is valid
    return res.status !== 401 && res.status !== 403;
  } catch { return false; }
}
