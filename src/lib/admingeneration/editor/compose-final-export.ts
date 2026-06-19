export type ComposeFinalExportInput = {
  projectId: string;
  timelineSnapshot?: Record<string, any>;
  outputUrl?: string | null;
  outputAssetId?: string | null;
  videoUrls?: string[];
  voiceoverUrl?: string | null;
  musicUrl?: string | null;
  sfxUrls?: string[];
  subtitleText?: string | null;
};

export type ComposeFinalExportResult =
  | { ok: true; outputUrl: string; metadata: Record<string, unknown> }
  | { ok: false; reason: string; metadata?: Record<string, unknown> };

const FAL_FFMPEG_MODEL = "fal-ai/ffmpeg-api";
const STITCH_TIMEOUT_MS = 120_000;

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function cleanUrl(value: unknown): string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : "";
}

function collectUrlsFromTimeline(timeline: any, keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const direct = timeline?.[key];
    if (typeof direct === "string") out.add(cleanUrl(direct));
    if (Array.isArray(direct)) direct.forEach((item) => out.add(cleanUrl(typeof item === "string" ? item : item?.url || item?.assetUrl || item?.storageUrl || item?.outputUrl)));
  }

  const layers = arr(timeline?.layers || timeline?.timeline?.layers);
  for (const layer of layers) {
    for (const block of arr(layer.blocks || layer.items)) {
      const layerId = String(layer.id || block.layer || "").toLowerCase();
      const url = cleanUrl(block.url || block.assetUrl || block.asset_url || block.storageUrl || block.outputUrl || block.metadata?.url || block.metadata?.assetUrl);
      if (!url) continue;
      if (keys.some((key) => layerId.includes(key.replace("Urls", "").replace("Clips", "")))) out.add(url);
    }
  }

  return Array.from(out).filter(Boolean);
}

function videoFilter(videoCount: number) {
  if (videoCount <= 1) return "[0:v:0]setpts=PTS-STARTPTS[vout]";
  const inputs = Array.from({ length: videoCount }, (_, index) => `[${index}:v:0]`).join("");
  return `${inputs}concat=n=${videoCount}:v=1:a=0[vout]`;
}

function audioFilter(videoCount: number, audioCount: number) {
  if (audioCount <= 0) return "anullsrc=channel_layout=stereo:sample_rate=44100[aout]";
  const inputs = Array.from({ length: audioCount }, (_, index) => `[${videoCount + index}:a:0]`).join("");
  return `${inputs}amix=inputs=${audioCount}:duration=longest:dropout_transition=2[aout]`;
}

export async function composeFinalExport(input: ComposeFinalExportInput): Promise<ComposeFinalExportResult> {
  if (input.outputUrl || input.outputAssetId) {
    return {
      ok: true,
      outputUrl: input.outputUrl || String(input.outputAssetId),
      metadata: { source: "supplied-output", outputAssetId: input.outputAssetId || null },
    };
  }

  const timeline = input.timelineSnapshot || {};
  const videoUrls = [
    ...arr(input.videoUrls).map(cleanUrl),
    ...collectUrlsFromTimeline(timeline, ["videoUrls", "videoClips", "clips"]),
  ].filter(Boolean);
  const audioUrls = [
    cleanUrl(input.voiceoverUrl),
    cleanUrl(input.musicUrl),
    ...arr(input.sfxUrls).map(cleanUrl),
    ...collectUrlsFromTimeline(timeline, ["voice", "music", "effects", "audioUrls"]),
  ].filter(Boolean);

  if (!videoUrls.length) {
    return { ok: false, reason: "No video clip URLs were available to compose.", metadata: { audioCount: audioUrls.length } };
  }

  const apiKey = process.env.FAL_API_KEY || process.env.FAL_KEY;
  if (!apiKey) {
    return { ok: false, reason: "FAL_API_KEY or FAL_KEY is required for final FFmpeg compose.", metadata: { videoCount: videoUrls.length, audioCount: audioUrls.length } };
  }

  const inputUrls = [...videoUrls, ...audioUrls];
  const filterComplex = `${videoFilter(videoUrls.length)};${audioFilter(videoUrls.length, audioUrls.length)}`;

  const body = {
    input_urls: inputUrls,
    filter_complex: filterComplex,
    output_map: { video: "[vout]", audio: "[aout]" },
    output_format: "mp4",
  };

  try {
    const res = await fetch(`https://fal.run/${FAL_FFMPEG_MODEL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(STITCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      return { ok: false, reason: `FFmpeg compose failed (${res.status}): ${err.detail || res.statusText}`, metadata: { body } };
    }

    const data = await res.json() as { output?: { url?: string }; video?: { url?: string }; url?: string };
    const outputUrl = data.output?.url || data.video?.url || data.url || "";
    if (!outputUrl) return { ok: false, reason: "FFmpeg compose returned no output URL.", metadata: { raw: data } };

    return {
      ok: true,
      outputUrl,
      metadata: {
        source: "compose-final-export",
        videoCount: videoUrls.length,
        audioCount: audioUrls.length,
        subtitleIncluded: Boolean(input.subtitleText || timeline.subtitleText),
      },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error), metadata: { videoCount: videoUrls.length, audioCount: audioUrls.length } };
  }
}
