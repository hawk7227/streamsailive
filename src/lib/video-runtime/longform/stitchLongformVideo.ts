/**
 * longform/stitchLongformVideo.ts
 *
 * Stitches ordered clip URLs into a single output via fal.ai FFmpeg API.
 * Single-clip short-circuit: returns that clip directly — no API call.
 * All errors return { status: "failed", reason } — never throws to caller.
 */

import { FAL_API_KEY } from "@/lib/env";

const FAL_FFMPEG_MODEL = "fal-ai/ffmpeg-api";
const STITCH_TIMEOUT_MS = 120_000;

type StitchResult =
  | { status: "completed"; outputUrl: string }
  | { status: "failed"; reason: string };

function buildConcatFilter(clipCount: number): string {
  const inputs = Array.from(
    { length: clipCount },
    (_, i) => "[" + i + ":v:0][" + i + ":a:0]",
  ).join("");
  return inputs + "concat=n=" + clipCount + ":v=1:a=1[outv][outa]";
}

export async function stitchLongformVideo(clipUrls: string[]): Promise<StitchResult> {
  if (clipUrls.length === 0) {
    return { status: "failed", reason: "STITCH_NO_CLIPS: clip list is empty" };
  }
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
    const res = await fetch("https://fal.run/" + FAL_FFMPEG_MODEL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Key " + apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(STITCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      return { status: "failed", reason: "STITCH_API_ERROR (" + res.status + "): " + (err.detail ?? res.statusText) };
    }

    const data = await res.json() as { output?: { url?: string }; video?: { url?: string }; url?: string };
    const outputUrl = data.output?.url ?? data.video?.url ?? data.url;
    if (!outputUrl) {
      return { status: "failed", reason: "STITCH_NO_OUTPUT: API returned no output URL" };
    }

    return { status: "completed", outputUrl };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "failed", reason: "STITCH_EXCEPTION: " + reason };
  }
}
