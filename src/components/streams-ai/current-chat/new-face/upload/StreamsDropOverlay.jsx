export default function StreamsDropOverlay({ active = false }) {
  if (!active) return null;

  return (
    <div role="status" aria-label="Drop files to upload">
      Drop files to upload
    </div>
  );
}
