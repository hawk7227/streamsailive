const DEFAULT_LANES = [
  "video / shots",
  "transcript phrases",
  "voice audio",
  "ambient audio",
  "music",
  "emotion",
  "motion",
  "body movement",
  "lip-sync",
  "versions",
  "references",
];

export default function VideoTimeline({ lanes = DEFAULT_LANES, selectedRange, onSelectLane }) {
  return (
    <footer aria-label="Video multi-lane timeline">
      <div>Timeline selection: {selectedRange?.type || "none"}</div>
      {lanes.map((lane) => (
        <button key={lane} type="button" onClick={() => onSelectLane?.(lane)}>
          {lane}
        </button>
      ))}
    </footer>
  );
}
