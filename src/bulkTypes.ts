import { falRun } from "./falQueue";
import { TranscriptResult } from "./types";

type ScribeWord = {
  text: string;
  start: number;
  end: number;
};

type ScribeSegment = {
  text: string;
  start: number;
  end: number;
  words?: ScribeWord[];
};

type ScribeResponse = {
  text: string;
  language?: string;
  segments?: ScribeSegment[];
};

export async function transcribeAudio(audioUrl: string): Promise<TranscriptResult> {
  const result = await falRun<ScribeResponse>("fal-ai/elevenlabs/speech-to-text/scribe-v2", {
    audio_url: audioUrl,
    diarize: false,
    timestamps_granularity: "word",
  });

  return {
    text: result.text,
    language: result.language,
    segments: (result.segments ?? []).map((segment, index) => ({
      id: `seg-${index}`,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      words: (segment.words ?? []).map((word) => ({
        word: word.text,
        start: word.start,
        end: word.end,
      })),
    })),
  };
}
