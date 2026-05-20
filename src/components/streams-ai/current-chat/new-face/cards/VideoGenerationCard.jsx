function videoUrl(video) {
  return video?.url || video?.previewUrl || video?.storageUrl || video?.artifactUrl || video?.generatedVideoUrl || "";
}

function canShareVideo(video) {
  const url = videoUrl(video);
  return Boolean(video?.artifactPersisted || video?.storageUrl || (url && !String(url).startsWith("data:")));
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
  const shareable = canShareVideo(video);
  const statusText = isReady ? "Video ready" : video?.status === "failed" ? video?.statusText || "Video failed" : video?.statusText || "Rendering video…";

  return (
    <article aria-label="Video generation card" className="streamsGeneratedMediaCard streamsGeneratedVideoCard">
      <strong>{isReady ? "Video ready" : "Generating video"}</strong>

      <button type="button" className="streamsGeneratedMediaPreview" disabled={!isReady} onClick={isReady ? onOpen : undefined}>
        {url ? (
          <video src={url} controls playsInline preload="metadata" />
        ) : (
          <div className="streamsGeneratedMediaSkeleton">{statusText}</div>
        )}
      </button>

      <div className="streamsGeneratedMediaMeta">
        <span>{statusText}</span>
        {video?.provider ? <span>Provider: {video.provider}</span> : null}
        {video?.duration ? <span>Duration: {video.duration}</span> : null}
      </div>

      <div className="streamsGeneratedMediaActions">
        <button type="button" disabled={!isReady} onClick={onOpen}>Open</button>
        <button type="button" disabled={!isReady} onClick={onDownload}>Download</button>
        <button type="button" disabled={!shareable} title={shareable ? "Copy video link" : "Copy link unavailable until autosave has a durable URL"} onClick={onCopyUrl}>Copy link</button>
        <button type="button" disabled={!isReady} onClick={onViewTranscript}>View transcript</button>
        <button type="button" disabled={!isReady} onClick={onViewScenes}>View scenes</button>
        <button type="button" disabled={!isReady} onClick={onExtractFrame}>Extract frame</button>
        <button type="button" disabled={!isReady} onClick={onRegenerateFromFrame}>Regenerate from frame</button>
      </div>
    </article>
  );
}
