import "../media/frameless-inline-media.css";

function imageUrl(image) {
  return image?.url || image?.previewUrl || image?.storageUrl || image?.artifactUrl || image?.imageUrl || "";
}

export default function ImageGenerationCard({
  image,
  onOpen,
  onDownload,
  onCopyUrl,
  onAnalyze,
  onEdit,
  onAnimate,
  onShare,
}) {
  const url = imageUrl(image);
  const isReady = image?.status === "ready" || image?.status === "completed" || Boolean(url);
  const statusText = image?.status === "failed"
    ? image?.statusText || "Image generation failed"
    : image?.statusText || "Generating image…";

  if (!isReady) {
    return <div className="streamsInlineMediaPending" role="status" aria-live="polite">{statusText}</div>;
  }

  return (
    <figure className="streamsInlineMedia streamsInlineImage" data-feature="image">
      <button type="button" className="streamsInlineMediaSurface" onClick={onOpen} aria-label="Open generated image">
        <img src={url} alt={image?.alt || image?.prompt || "Generated image"} />
      </button>
      <div className="streamsInlineMediaActions" aria-label="Image actions">
        {onEdit ? <button type="button" onClick={onEdit}>Edit</button> : null}
        {onAnimate ? <button type="button" onClick={onAnimate}>Animate</button> : null}
        {onAnalyze ? <button type="button" onClick={onAnalyze}>Analyze</button> : null}
        {onDownload ? <button type="button" onClick={onDownload}>Download</button> : null}
        {onCopyUrl ? <button type="button" onClick={onCopyUrl}>Copy link</button> : null}
        {onShare && typeof navigator !== "undefined" && navigator.share ? <button type="button" onClick={onShare}>Share</button> : null}
      </div>
    </figure>
  );
}
