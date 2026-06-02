export type MasterSyncSourceStatus = "loaded" | "missing" | "error";

export type MasterSyncSegment = {
  id: string;
  kind: "scene" | "shot" | "clip" | "transcript" | "audio" | "motion" | "caption";
  label: string;
  startSec: number;
  endSec: number;
  frameStart: number;
  frameEnd: number;
  sourceIds: string[];
  linkedTargets: {
    sceneId?: string | null;
    shotId?: string | null;
    segmentId?: string | null;
    transcriptId?: string | null;
    speakerId?: string | null;
    subjectId?: string | null;
    audioId?: string | null;
    versionId?: string | null;
    providerRunId?: string | null;
  };
  qa: {
    identity: "unknown" | "pass" | "fail" | "needs_check";
    hands: "unknown" | "pass" | "fail" | "needs_check";
    mouthSync: "unknown" | "pass" | "fail" | "needs_check";
    audioSync: "unknown" | "pass" | "fail" | "needs_check";
    continuity: "unknown" | "pass" | "fail" | "needs_check";
  };
};

export type MasterSyncWord = {
  id: string;
  word: string;
  startSec: number;
  endSec: number;
  speakerId: string | null;
  transcriptSegmentId: string | null;
  frameStart: number;
  frameEnd: number;
};

export type MasterSyncTrack = {
  id: string;
  label: string;
  kind: "video" | "scene" | "shot" | "motion" | "transcript" | "translation" | "voice" | "music" | "ambient" | "audio" | "effects" | "caption" | "version" | "qa";
  segmentIds: string[];
};

export type MasterTimelineSync = {
  projectId: string;
  fps: number;
  durationSec: number;
  frameCount: number;
  sources: Record<string, MasterSyncSourceStatus>;
  tracks: MasterSyncTrack[];
  segments: MasterSyncSegment[];
  words: MasterSyncWord[];
  versionGraph: {
    originalVersionId: string | null;
    activeVersionId: string | null;
    versionIds: string[];
  };
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function frameAt(sec: number, fps: number) {
  return Math.max(0, Math.round(sec * fps));
}

function normalizeRawSegment(raw: any, index: number, fps: number): MasterSyncSegment {
  const startSec = asNumber(raw?.startSec ?? raw?.start_sec, index * 5);
  const endSec = asNumber(raw?.endSec ?? raw?.end_sec, startSec + 5);
  const id = asString(raw?.id ?? raw?.segmentId ?? raw?.segment_id, `segment-${index + 1}`);

  return {
    id,
    kind: raw?.kind || raw?.type || "clip",
    label: asString(raw?.label ?? raw?.title ?? raw?.metadata?.sceneTitle, `Segment ${index + 1}`),
    startSec,
    endSec,
    frameStart: asNumber(raw?.frameStart ?? raw?.frame_start, frameAt(startSec, fps)),
    frameEnd: asNumber(raw?.frameEnd ?? raw?.frame_end, frameAt(endSec, fps)),
    sourceIds: asArray(raw?.sourceIds ?? raw?.source_ids),
    linkedTargets: {
      sceneId: raw?.sceneId ?? raw?.scene_id ?? null,
      shotId: raw?.shotId ?? raw?.shot_id ?? null,
      segmentId: id,
      transcriptId: raw?.transcriptId ?? raw?.transcript_id ?? null,
      speakerId: raw?.speakerId ?? raw?.speaker_id ?? null,
      subjectId: raw?.subjectId ?? raw?.subject_id ?? null,
      audioId: raw?.audioId ?? raw?.audio_id ?? null,
      versionId: raw?.versionId ?? raw?.version_id ?? null,
      providerRunId: raw?.providerRunId ?? raw?.provider_run_id ?? null,
    },
    qa: {
      identity: "needs_check",
      hands: "needs_check",
      mouthSync: "needs_check",
      audioSync: "needs_check",
      continuity: "needs_check",
    },
  };
}

function normalizeWords(raw: any, fps: number): MasterSyncWord[] {
  const transcript = raw?.transcript || raw?.intelligence?.transcript || raw?.timeline?.transcript || {};
  const words = asArray(
    transcript?.words ||
    transcript?.word_timestamps ||
    raw?.word_timestamps ||
    raw?.intelligence?.word_timestamps,
  );

  return words.map((word: any, index: number) => {
    const startSec = asNumber(word?.startSec ?? word?.start ?? word?.start_time, index * 0.35);
    const endSec = asNumber(word?.endSec ?? word?.end ?? word?.end_time, startSec + 0.35);

    return {
      id: asString(word?.id, `word-${index + 1}`),
      word: asString(word?.word ?? word?.text, `word-${index + 1}`),
      startSec,
      endSec,
      speakerId: word?.speakerId ?? word?.speaker_id ?? null,
      transcriptSegmentId: word?.segmentId ?? word?.segment_id ?? null,
      frameStart: frameAt(startSec, fps),
      frameEnd: frameAt(endSec, fps),
    };
  });
}

function makeTrack(id: MasterSyncTrack["id"], label: string, kind: MasterSyncTrack["kind"], segments: MasterSyncSegment[]) {
  return {
    id,
    label,
    kind,
    segmentIds: segments
      .filter((segment) => {
        if (kind === "scene") return segment.kind === "scene";
        if (kind === "shot") return segment.kind === "shot";
        if (kind === "transcript") return segment.kind === "transcript";
        if (kind === "audio") return segment.kind === "audio";
        if (kind === "motion") return segment.kind === "motion";
        if (kind === "caption") return segment.kind === "caption";
        return true;
      })
      .map((segment) => segment.id),
  };
}

export function buildMasterTimelineSync(input: {
  projectId: string;
  timeline?: any;
  intelligence?: any;
  versions?: any;
  providerRuns?: any;
  qc?: any;
}): MasterTimelineSync {
  const fps = asNumber(
    input.timeline?.fps ??
      input.timeline?.timeline?.fps ??
      input.intelligence?.fps ??
      input.intelligence?.metadata?.fps,
    24,
  );

  const rawSegments =
    asArray(input.timeline?.timeline?.segments) ||
    asArray(input.timeline?.segments) ||
    asArray(input.intelligence?.segments) ||
    asArray(input.intelligence?.intelligence?.segments);

  const segments = (rawSegments.length ? rawSegments : []).map((segment, index) =>
    normalizeRawSegment(segment, index, fps),
  );

  const durationSec = Math.max(
    asNumber(input.timeline?.durationSec ?? input.timeline?.timeline?.durationSec, 0),
    ...segments.map((segment) => segment.endSec),
    0,
  );

  const words = normalizeWords(
    {
      timeline: input.timeline,
      intelligence: input.intelligence,
      transcript: input.intelligence?.transcript,
      word_timestamps: input.intelligence?.word_timestamps,
    },
    fps,
  );

  const tracks: MasterSyncTrack[] = [
    makeTrack("video", "Video", "video", segments),
    makeTrack("scene", "Scenes", "scene", segments),
    makeTrack("shot", "Shots", "shot", segments),
    makeTrack("motion", "Motion / Gesture", "motion", segments),
    makeTrack("transcript", "Transcript / Dialogue", "transcript", segments),
    makeTrack("voice", "Voice", "voice", segments),
    makeTrack("music", "Music", "music", segments),
    makeTrack("ambient", "Ambient", "ambient", segments),
    makeTrack("effects", "Effects", "effects", segments),
    makeTrack("caption", "Captions", "caption", segments),
    makeTrack("version", "Versions", "version", segments),
    makeTrack("qa", "QA", "qa", segments),
  ];

  const versions = asArray(input.versions?.versions || input.versions?.items || input.versions);
  const activeVersion = versions.find((version) => version?.status === "active" || version?.isActive);
  const originalVersion = versions.find((version) => version?.status === "source" || version?.isOriginal) || versions[0];

  return {
    projectId: input.projectId,
    fps,
    durationSec,
    frameCount: frameAt(durationSec, fps),
    sources: {
      timeline: input.timeline ? "loaded" : "missing",
      intelligence: input.intelligence ? "loaded" : "missing",
      versions: input.versions ? "loaded" : "missing",
      providerRuns: input.providerRuns ? "loaded" : "missing",
      qc: input.qc ? "loaded" : "missing",
    },
    tracks,
    segments,
    words,
    versionGraph: {
      originalVersionId: originalVersion?.id || null,
      activeVersionId: activeVersion?.id || originalVersion?.id || null,
      versionIds: versions.map((version) => version?.id).filter(Boolean),
    },
  };
}
