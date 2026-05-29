import { YoutubeTranscript } from "youtube-transcript";
import { buildProviderReadyPrompt, emptyBlueprint, type VideoReferenceBlueprint, type VideoReferenceSourceType } from "./video-reference-blueprint";

const YT_PATTERNS = [
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

export function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function getYouTubeMetadata(url: string) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) throw new Error("Could not extract YouTube video ID.");

  let title = "";
  let channelName = "";
  let thumbnailUrl = "";

  try {
    const oEmbed = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000), cache: "no-store" },
    );

    if (oEmbed.ok) {
      const data = (await oEmbed.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
      title = data.title || "";
      channelName = data.author_name || "";
      thumbnailUrl = data.thumbnail_url || "";
    }
  } catch {
    // oEmbed is non-fatal.
  }

  return { videoId, title, channelName, thumbnailUrl };
}

export async function getYouTubeTranscript(videoId: string) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function transcriptTimingMap(transcript: string) {
  const sentences = transcript
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20)
    .slice(0, 12);

  return sentences.map((sentence, index) => ({
    timeSec: index * 5,
    event: sentence,
  }));
}

function transcriptShots(transcript: string) {
  const sentences = transcript
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20)
    .slice(0, 6);

  return sentences.map((sentence, index) => ({
    shotIndex: index + 1,
    startSec: index * 5,
    endSec: index * 5 + 5,
    durationSec: 5,
    frameAssetIds: [],
    sceneDescription: `Transcript-derived beat: ${sentence}`,
    subjectDescription: "Pending frame extraction and subject detection.",
    environment: "Pending frame extraction and environment analysis.",
    cameraMovement: "Pending optical-flow/frame sequence analysis.",
    lensComposition: "Pending frame composition analysis.",
    lighting: "Pending frame luminance/color analysis.",
    motion: "Pending frame sequence motion analysis.",
    pacing: "Estimated from transcript beats; requires frame/audio timing for proof.",
    dialogueOrNarration: sentence,
    soundDesign: "Pending audio extraction and sound/music analysis.",
  }));
}

export function buildTranscriptOnlyBlueprint(input: {
  sourceType: VideoReferenceSourceType;
  sourceUrl?: string | null;
  sourceAssetId?: string | null;
  title?: string | null;
  transcript?: string | null;
}): VideoReferenceBlueprint {
  const transcript = input.transcript || "";
  const title = input.title || "Video reference";
  const blueprint = emptyBlueprint({ ...input, title, transcript });

  blueprint.summary = {
    title,
    conciseSummary: transcript
      ? "Transcript was captured. Full visual/audio duplication still requires source video ingest, frame extraction, audio extraction, shot detection, and visual/audio model analysis."
      : "Source accepted. Full analysis requires worker frame/audio extraction.",
    recreateGoal:
      "Create a similar production only after the frame/audio worker produces a complete shot, style, motion, and sound blueprint.",
  };
  blueprint.shots = transcriptShots(transcript);
  blueprint.audioLanguage.transcript = transcript;
  blueprint.timingMap = transcriptTimingMap(transcript);
  blueprint.generation.providerReadyPrompt = buildProviderReadyPrompt(blueprint);
  blueprint.generation.recreatePrompt = blueprint.generation.providerReadyPrompt;

  return blueprint;
}

export async function buildInitialVideoReferenceBlueprint(input: {
  sourceType: VideoReferenceSourceType;
  sourceUrl?: string | null;
  sourceAssetId?: string | null;
  title?: string | null;
}) {
  if (input.sourceType === "youtube" && input.sourceUrl) {
    const meta = await getYouTubeMetadata(input.sourceUrl);
    const transcript = await getYouTubeTranscript(meta.videoId);
    return {
      videoId: meta.videoId,
      title: meta.title,
      channelName: meta.channelName,
      thumbnailUrl: meta.thumbnailUrl,
      transcript,
      blueprint: buildTranscriptOnlyBlueprint({
        sourceType: "youtube",
        sourceUrl: input.sourceUrl,
        title: meta.title || input.title || "YouTube reference",
        transcript,
      }),
    };
  }

  return {
    videoId: null,
    title: input.title || "Uploaded video reference",
    channelName: "",
    thumbnailUrl: "",
    transcript: "",
    blueprint: emptyBlueprint({
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      sourceAssetId: input.sourceAssetId,
      title: input.title || "Uploaded video reference",
    }),
  };
}

export function requiredWorkerCapabilities() {
  return [
    "download or read durable source video asset",
    "ffprobe video metadata",
    "ffmpeg frame extraction",
    "shot boundary detection",
    "ffmpeg audio extraction",
    "speech transcription",
    "visual frame analysis",
    "camera/motion analysis from frame sequence",
    "voice/music/sound design analysis",
    "blueprint persistence",
  ];
}
