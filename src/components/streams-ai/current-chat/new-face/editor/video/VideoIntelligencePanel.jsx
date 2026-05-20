export default function VideoIntelligencePanel({ asset, selectedRange, onSelectRange }) {
  const transcript = asset?.transcriptSegments || [];
  const tracks = [
    { id: "transcript", label: transcript.length ? "Transcript ready" : "No transcript yet" },
    { id: "motion", label: asset?.motionTrack ? "Motion track ready" : "No motion track yet" },
    { id: "emotion", label: asset?.emotionTrack ? "Emotion track ready" : "No emotion track yet" },
    { id: "person", label: asset?.personProfile ? "Person profile ready" : "No person profile yet" },
  ];

  return (
    <aside aria-label="Video intelligence panel">
      <h3>Transcript</h3>
      {transcript.length ? (
        transcript.map((segment) => (
          <button
            key={segment.id}
            type="button"
            aria-pressed={selectedRange?.id === segment.id}
            onClick={() => onSelectRange?.({
              type: "transcript",
              id: segment.id,
              startTime: segment.startTime,
              endTime: segment.endTime,
              trackType: "voice",
            })}
          >
            {segment.text} · {segment.startTime}s
          </button>
        ))
      ) : (
        <p>No transcript yet</p>
      )}

      <h3>Tracks</h3>
      {tracks.map((track) => (
        <div key={track.id}>{track.label}</div>
      ))}
    </aside>
  );
}
