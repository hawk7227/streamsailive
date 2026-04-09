import { TranscriptResult } from "./types";

export function updateTranscriptSegment(
  transcript: TranscriptResult,
  segmentId: string,
  nextText: string,
): TranscriptResult {
  return {
    ...transcript,
    text: transcript.segments.map((segment) => segment.id === segmentId ? nextText : segment.text).join(" ").trim(),
    segments: transcript.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, text: nextText } : segment,
    ),
  };
}
