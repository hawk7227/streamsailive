function videoUrl(video) {
  return video?.url || video?.previewUrl || video?.storageUrl || video?.artifactUrl || video?.generatedVideoUrl || "";
}

export default function VideoGenerationCard({
  video,
  onOpen,
  onDownload,
  onCopyUrl,
  onViewTranscript,
  onViewScenes,
  onExtractFrame,
  onRegenerateFromFrame,
}) {
  const url = videoUrl(video);
  const isReady = video?.status === "ready" || video?.status === "completed" || Boolean(url);
  const statusText = video?.status === "failed"
    ? video?.statusText || "Video generation failed"
    : video?.statusText || "Rendering video…";

  if (!isReady) {
    return <div className="streamsInlineMediaPending" role="status" aria-live="polite">{statusText}</div>;
  }

  return (
    <figure className="streamsInlineMedia streamsInlineVideo" data-feature="video">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onDoubleClick={onOpen}
        aria-label="Generated video"
      />
      <div className="streamsInlineMediaActions" aria-label="Video actions">
        {onOpen ? <button type="button" onClick={onOpen}>Open</button> : null}
        {onViewTranscript ? <button type="button" onClick={onViewTranscript}>Transcript</button> : null}
        {onViewScenes ? <button type="button" onClick={onViewScenes}>Scenes</button> : null}
        {onExtractFrame ? <button type="button" onClick={onExtractFrame}>Frame</button> : null}
        {onRegenerateFromFrame ? <button type="button" onClick={onRegenerateFromFrame}>Regenerate</button> : null}
        {onDownload ? <button type="button" onClick={onDownload}>Download</button> : null}
        {onCopyUrl ? <button type="button" onClick={onCopyUrl}>Copy link</button> : null}
      </div>
    </figure>
  );
}
