"use client";

import { TranscriptResult } from "@/lib/pipeline-test/types";

export default function TranscriptEditorPanel({
  transcript,
  onSegmentChange,
}: {
  transcript: TranscriptResult | null;
  onSegmentChange: (segmentId: string, nextText: string) => void;
}) {
  if (!transcript) return null;

  return (
    <div style={{ marginTop: 16, border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
      <h3>Transcript Editor</h3>
      <p style={{ opacity: 0.8 }}>Edit text per segment before commit.</p>
      <div style={{ display: "grid", gap: 12 }}>
        {transcript.segments.map((segment) => (
          <div key={segment.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {segment.start.toFixed(2)}s → {segment.end.toFixed(2)}s
            </div>
            <textarea
              value={segment.text}
              onChange={(e) => onSegmentChange(segment.id, e.target.value)}
              style={{ width: "100%", minHeight: 70, marginTop: 8 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
