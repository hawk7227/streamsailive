export default function VideoEditorPanel({
  asset,
  onDownload,
  onExtractFrame,
  onRegenerateFromFrame,
  onViewTranscript,
  onViewScenes,
}) {
  return (
    <section aria-label="Video editor panel">
      <h2>{asset?.name || "Video"}</h2>

      {asset?.previewUrl ? (
        <video src={asset.previewUrl} controls />
      ) : null}

      {asset?.duration ? <div>Duration: {asset.duration}</div> : null}
      {asset?.provider ? <div>Provider: {asset.provider}</div> : null}
      {asset?.prompt ? <p>{asset.prompt}</p> : null}

      <button type="button" onClick={onViewTranscript}>View transcript</button>
      <button type="button" onClick={onViewScenes}>View scenes</button>
      <button type="button" onClick={onExtractFrame}>Extract frame</button>
      <button type="button" onClick={onRegenerateFromFrame}>Regenerate from frame</button>
      <button type="button" onClick={onDownload}>Download</button>
    </section>
  );
}
