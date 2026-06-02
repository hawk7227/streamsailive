export type WordSpeakerToken = {
  id: string;
  word: string;
  startSec: number;
  endSec: number;
  speakerId: string | null;
  speakerLabel: string;
  transcriptSegmentId: string | null;
  frameStart: number;
  frameEnd: number;
};

export type SpeakerSegment = {
  id: string;
  speakerId: string;
  speakerLabel: string;
  startSec: number;
  endSec: number;
  wordIds: string[];
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

export function buildWordSpeakerMap(input: {
  intelligence?: any;
  timeline?: any;
  fps?: number;
}) {
  const fps = asNumber(input.fps || input.timeline?.fps || input.intelligence?.fps || input.intelligence?.metadata?.fps, 24);

  const transcript =
    input.intelligence?.transcript ||
    input.intelligence?.intelligence?.transcript ||
    input.timeline?.transcript ||
    input.timeline?.timeline?.transcript ||
    {};

  const rawWords = asArray(
    transcript.words ||
      transcript.word_timestamps ||
      input.intelligence?.word_timestamps ||
      input.intelligence?.intelligence?.word_timestamps,
  );

  const rawSpeakers = asArray(
    transcript.speakers ||
      transcript.speaker_segments ||
      input.intelligence?.speaker_segments ||
      input.intelligence?.intelligence?.speaker_segments,
  );

  const words: WordSpeakerToken[] = rawWords.map((raw, index) => {
    const startSec = asNumber(raw.startSec ?? raw.start ?? raw.start_time, index * 0.35);
    const endSec = asNumber(raw.endSec ?? raw.end ?? raw.end_time, startSec + 0.35);
    const speakerId = raw.speakerId ?? raw.speaker_id ?? raw.speaker ?? null;

    return {
      id: asString(raw.id, `word-${index + 1}`),
      word: asString(raw.word ?? raw.text, `word-${index + 1}`),
      startSec,
      endSec,
      speakerId,
      speakerLabel: speakerId ? `Speaker ${speakerId}` : "Unknown speaker",
      transcriptSegmentId: raw.segmentId ?? raw.segment_id ?? null,
      frameStart: frameAt(startSec, fps),
      frameEnd: frameAt(endSec, fps),
    };
  });

  const speakerSegments: SpeakerSegment[] = rawSpeakers.map((raw, index) => {
    const startSec = asNumber(raw.startSec ?? raw.start ?? raw.start_time, 0);
    const endSec = asNumber(raw.endSec ?? raw.end ?? raw.end_time, startSec);
    const speakerId = String(raw.speakerId ?? raw.speaker_id ?? raw.speaker ?? `speaker-${index + 1}`);

    return {
      id: asString(raw.id, `speaker-segment-${index + 1}`),
      speakerId,
      speakerLabel: asString(raw.label ?? raw.speakerLabel, `Speaker ${speakerId}`),
      startSec,
      endSec,
      wordIds: words
        .filter((word) => word.speakerId === speakerId || (word.startSec >= startSec && word.endSec <= endSec))
        .map((word) => word.id),
    };
  });

  return {
    ok: true,
    fps,
    wordCount: words.length,
    speakerCount: speakerSegments.length,
    words,
    speakerSegments,
    status: words.length ? "loaded" : "missing_word_timestamps",
  };
}
