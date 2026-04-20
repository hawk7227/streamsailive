/**
 * src/lib/video/scene-stitcher.ts
 *
 * Stitches ordered video scene clips into a single output using
 * the fal.ai FFmpeg API (fal-ai/ffmpeg-api).
 *
 * Constraints:
 * - Must not run inside an HTTP request handler — called from cron worker only
 * - Timeout: 120s (stitch is CPU-bound on fal infrastructure, not in Vercel)
 * - Single-clip short-circuit: if N=1, return that clip URL directly
 * - All errors return { status: "failed", reason } — never throw to caller
 */

import { FAL_API_KEY } from "@/lib/env";
import type { StitchResult } from "./types";

const FAL_FFMPEG_MODEL = "fal-ai/ffmpeg-api";
const STITCH_TIMEOUT_MS = 120_000;

/**
 * Build an FFmpeg concat filter for N input clips.
 * Each clip is referenced by index [N:v:0][N:a:0].
 * Output streams are labeled [outv] and [outa].
 */
function buildConcatFilter(clipCount: number): string {
  const inputs = Array.from(
    { length: clipCount },
    (_, i) => `[${i}:v:0][${i}:a:0]`,
  ).join("");
  return `${inputs}concat=n=${clipCount}:v=1:a=1[outv][outa]`;
}

export async function stitchVideoScenes(
  clipUrls: string[],
): Promise<StitchResult> {
  if (clipUrls.length === 0) {
    return { status: "failed", reason: "STITCH_NO_CLIPS: clip list is empty" };
  }

  // Single clip — no stitch needed
  if (clipUrls.length === 1) {
    return { status: "completed", outputUrl: clipUrls[0] };
  }

  const apiKey = FAL_API_KEY;
  if (!apiKey) {
    return { status: "failed", reason: "STITCH_NO_KEY: FAL_API_KEY not set" };
  }

  const body = {
    input_urls: clipUrls,
    filter_complex: buildConcatFilter(clipUrls.length),
    output_map: { video: "[outv]", audio: "[outa]" },
    output_format: "mp4",
  };

  try {
    const res = await fetch(`https://fal.run/${FAL_FFMPEG_MODEL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(STITCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      return {
        status: "failed",
        reason: `STITCH_API_ERROR (${res.status}): ${err.detail ?? res.statusText}`,
      };
    }

    const data = await res.json() as {
      output?: { url?: string };
      video?: { url?: string };
      url?: string;
    };

    const outputUrl =
      data.output?.url ?? data.video?.url ?? data.url;

    if (!outputUrl) {
      return {
        status: "failed",
        reason: "STITCH_NO_OUTPUT: API returned no output URL",
      };
    }

    return { status: "completed", outputUrl };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : String(error);
    return { status: "failed", reason: `STITCH_EXCEPTION: ${reason}` };
  }
}
