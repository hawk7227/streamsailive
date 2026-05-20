export default function VideoPreviewCanvas({ asset, selectedRange, compareMode = "current" }) {
  return (
    <main aria-label="Video preview canvas">
      <div>Compare: {compareMode}</div>
      {asset?.previewUrl ? (
        <video src={asset.previewUrl} controls />
      ) : (
        <div>No video preview available.</div>
      )}
      <div>
        Selection: {selectedRange?.type || "none"} {selectedRange?.startTime ?? 0}s–{selectedRange?.endTime ?? 0}s
      </div>
      {asset?.duration ? <div>Duration: {asset.duration}</div> : null}
    </main>
  );
}
