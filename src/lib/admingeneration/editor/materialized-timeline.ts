export type MaterializedTimelineBlock = {
  id: string;
  layer: string;
  targetType: string;
  label: string;
  startSec: number;
  endSec: number;
  segmentId: string | null;
  source: "analyzer" | "timeline" | "asset" | "deterministic";
  metadata: Record<string, unknown>;
};

export type MaterializedTimelineLayer = {
  id: string;
  label: string;
  sub: string;
  color: string;
  status: "ready" | "needs_analyzer_data";
  blocks: MaterializedTimelineBlock[];
};

export type MaterializedTimeline = {
  ok: true;
  projectId: string;
  layers: MaterializedTimelineLayer[];
  sourceStatus: {
    hasSegments: boolean;
    hasTranscript: boolean;
    hasWords: boolean;
    hasAudioAssets: boolean;
    hasMotion: boolean;
    hasCaptions: boolean;
  };
};

const LAYERS = [
  { id: "motion", label: "MOTION / ACTION LAYER", sub: "Movement & Actions", color: "green" },
  { id: "dialogue", label: "TRANSCRIPT / DIALOGUE LAYER", sub: "Spoken Words / Dialogue", color: "blue" },
  { id: "translation", label: "TRANSLATION LAYER", sub: "Translation", color: "purple" },
  { id: "lipsync", label: "LIP-SYNC LAYER", sub: "Mouth & Lip Movements", color: "pink" },
  { id: "voice", label: "AUDIO / DIALOGUE LAYER", sub: "Dialogue & Voice", color: "teal" },
  { id: "music", label: "AUDIO / MUSIC LAYER", sub: "Music & Background Score", color: "greenWave" },
  { id: "effects", label: "AUDIO / EFFECTS LAYER", sub: "SFX & Ambient Sounds", color: "orange" },
  { id: "subtitle", label: "SUBTITLE LAYER", sub: "On-Screen Subtitles", color: "gold" },
] as const;

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function rootOf(intelligence: any) {
  return intelligence?.intelligence || intelligence || {};
}

function getSegments(timeline: any, intelligence: any) {
  const root = rootOf(intelligence);
  return arr(timeline?.timeline?.segments).length
    ? arr(timeline.timeline.segments)
    : arr(timeline?.segments).length
      ? arr(timeline.segments)
      : arr(root.scene_segments).length
        ? arr(root.scene_segments)
        : arr(root.shot_segments).length
          ? arr(root.shot_segments)
          : arr(root.segments);
}

function getTranscript(root: any) {
  return root.transcript || {};
}

function getTranscriptSegments(root: any) {
  const transcript = getTranscript(root);
  return arr(transcript.segments).length
    ? arr(transcript.segments)
    : arr(transcript.items).length
      ? arr(transcript.items)
      : arr(root.transcript_segments).length
        ? arr(root.transcript_segments)
        : arr(root.speakingSegments).length
          ? arr(root.speakingSegments)
          : arr(root.speaking_segments);
}

function getWords(root: any) {
  const transcript = getTranscript(root);
  return arr(transcript.words).length
    ? arr(transcript.words)
    : arr(transcript.word_timestamps).length
      ? arr(transcript.word_timestamps)
      : arr(root.word_timestamps).length
        ? arr(root.word_timestamps)
        : arr(root.wordTimestamps);
}

function getMotion(root: any) {
  return arr(root.motion_segments).length
    ? arr(root.motion_segments)
    : arr(root.motionSegments).length
      ? arr(root.motionSegments)
      : arr(root.motion_profile?.segments).length
        ? arr(root.motion_profile.segments)
        : arr(root.gesture_segments).length
          ? arr(root.gesture_segments)
          : arr(root.gestureSegments);
}

function getLipSync(root: any) {
  return arr(root.lip_sync_segments).length
    ? arr(root.lip_sync_segments)
    : arr(root.lipsync_segments).length
      ? arr(root.lipsync_segments)
      : arr(root.lipSyncSegments);
}

function getTranslations(root: any) {
  return arr(root.translations).length
    ? arr(root.translations)
    : arr(root.translation_segments).length
      ? arr(root.translation_segments)
      : arr(root.translationSegments);
}

function getCaptions(root: any) {
  return arr(root.caption_segments).length
    ? arr(root.caption_segments)
    : arr(root.captionSegments).length
      ? arr(root.captionSegments)
      : arr(root.subtitles).length
        ? arr(root.subtitles)
        : arr(root.subtitle_segments).length
          ? arr(root.subtitle_segments)
          : arr(root.transcript?.captions);
}

function getAudioSegments(root: any, kind: "voice" | "music" | "effects") {
  const audio = root.audio || {};
  if (kind === "voice") {
    return arr(audio.voice).length ? arr(audio.voice)
      : arr(audio.dialogue).length ? arr(audio.dialogue)
      : arr(root.voice_segments).length ? arr(root.voice_segments)
      : arr(root.dialogue_segments);
  }

  if (kind === "music") {
    return arr(audio.music).length ? arr(audio.music)
      : arr(root.music_segments).length ? arr(root.music_segments)
      : arr(root.audio_music_segments);
  }

  return arr(audio.effects).length ? arr(audio.effects)
    : arr(audio.ambient).length ? arr(audio.ambient)
    : arr(root.effects_segments).length ? arr(root.effects_segments)
    : arr(root.ambient_segments);
}

function getAudioAssets(assets: any[], layer: "voice" | "music" | "effects") {
  return assets.filter((asset) => {
    const kind = String(asset.kind || asset.assetKind || asset.asset_kind || "").toLowerCase();
    if (layer === "voice") return kind.includes("voice") || kind.includes("dialogue") || kind.includes("audio");
    if (layer === "music") return kind.includes("music");
    return kind.includes("ambient") || kind.includes("effect") || kind.includes("sfx");
  });
}

function blockFromItem(input: {
  layerId: string;
  item: any;
  index: number;
  source: MaterializedTimelineBlock["source"];
  fallbackStart: number;
  fallbackEnd: number;
}) : MaterializedTimelineBlock {
  const item = input.item || {};
  const startSec = num(item.startSec ?? item.start_sec ?? item.start ?? item.start_time, input.fallbackStart);
  const endSec = num(item.endSec ?? item.end_sec ?? item.end ?? item.end_time, input.fallbackEnd || startSec + 1);
  const id = str(item.id || item.segmentId || item.segment_id || item.wordId, `${input.layerId}-${input.index + 1}`);

  return {
    id: `${input.layerId}-${id}`,
    layer: input.layerId,
    targetType: input.layerId,
    label:
      str(item.label, "") ||
      str(item.text, "") ||
      str(item.word, "") ||
      str(item.transcript, "") ||
      str(item.description, "") ||
      `${input.layerId} ${input.index + 1}`,
    startSec,
    endSec,
    segmentId: item.segmentId || item.segment_id || item.id || null,
    source: input.source,
    metadata: item.metadata || item,
  };
}

function blocksForLayer(input: {
  layerId: string;
  segments: any[];
  root: any;
  assets: any[];
}) {
  let raw: any[] = [];
  let source: MaterializedTimelineBlock["source"] = "analyzer";

  if (input.layerId === "motion") raw = getMotion(input.root);
  if (input.layerId === "dialogue") raw = getTranscriptSegments(input.root);
  if (input.layerId === "translation") raw = getTranslations(input.root);
  if (input.layerId === "lipsync") raw = getLipSync(input.root);
  if (input.layerId === "voice") raw = getAudioSegments(input.root, "voice");
  if (input.layerId === "music") raw = getAudioSegments(input.root, "music");
  if (input.layerId === "effects") raw = getAudioSegments(input.root, "effects");
  if (input.layerId === "subtitle") raw = getCaptions(input.root);

  if (input.layerId === "dialogue" && raw.length === 0) {
    const words = getWords(input.root);
    if (words.length) raw = words;
  }

  if (["voice", "music", "effects"].includes(input.layerId) && raw.length === 0) {
    raw = getAudioAssets(input.assets, input.layerId as "voice" | "music" | "effects");
    source = "asset";
  }

  return raw.map((item, index) => {
    const segment = input.segments[index] || {};
    return blockFromItem({
      layerId: input.layerId,
      item,
      index,
      source,
      fallbackStart: num(segment.startSec ?? segment.start_sec, index * 5),
      fallbackEnd: num(segment.endSec ?? segment.end_sec, (index + 1) * 5),
    });
  });
}

export function buildMaterializedTimeline(input: {
  projectId: string;
  timeline?: any;
  intelligence?: any;
  assets?: any[];
}): MaterializedTimeline {
  const root = rootOf(input.intelligence);
  const assets = arr(input.assets || root.assets);
  const segments = getSegments(input.timeline, root);

  const layers = LAYERS.map((layer) => {
    const blocks = blocksForLayer({
      layerId: layer.id,
      segments,
      root,
      assets,
    });

    return {
      ...layer,
      status: blocks.length ? "ready" : "needs_analyzer_data",
      blocks,
    };
  });

  return {
    ok: true,
    projectId: input.projectId,
    layers,
    sourceStatus: {
      hasSegments: segments.length > 0,
      hasTranscript: getTranscriptSegments(root).length > 0,
      hasWords: getWords(root).length > 0,
      hasAudioAssets: assets.length > 0,
      hasMotion: getMotion(root).length > 0,
      hasCaptions: getCaptions(root).length > 0,
    },
  };
}
