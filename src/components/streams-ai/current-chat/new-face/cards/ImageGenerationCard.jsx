function imageUrl(image) {
  return image?.url || image?.previewUrl || image?.storageUrl || image?.artifactUrl || image?.imageUrl || "";
}

function canShareImage(image) {
  const url = imageUrl(image);
  return Boolean(image?.artifactPersisted || image?.storageUrl || (url && !String(url).startsWith("data:")));
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
  const size =
    image?.width && image?.height
      ? `${image.width} × ${image.height}`
      : image?.requestSizeLabel || image?.size || image?.sizeLabel || "";

  const isReady = image?.status === "ready" || image?.status === "completed" || Boolean(url);
  const shareable = canShareImage(image);
  const statusText = isReady ? "Image ready" : image?.status === "failed" ? image?.statusText || "Image failed" : image?.statusText || "Generating image…";

  return (
    <article aria-label="Image generation card" className="streamsGeneratedMediaCard streamsGeneratedImageCard">
      <strong>{isReady ? "Image ready" : "Generating image"}</strong>

      <button type="button" className="streamsGeneratedMediaPreview" disabled={!isReady} onClick={isReady ? onOpen : undefined}>
        {url ? (
          <img src={url} alt={image?.alt || image?.prompt || "Generated"} />
        ) : (
          <div className="streamsGeneratedMediaSkeleton">{statusText}</div>
        )}
      </button>

      <div className="streamsGeneratedMediaMeta">
        <span>{statusText}</span>
        {size ? <span>{size}</span> : null}
        {image?.provider ? <span>Provider: {image.provider}</span> : null}
      </div>

      <div className="streamsGeneratedMediaActions">
        <button type="button" disabled={!isReady} onClick={onOpen}>Open</button>
        <button type="button" disabled={!isReady} onClick={onDownload}>Download</button>
        <button type="button" disabled={!shareable} title={shareable ? "Copy image link" : "Copy link unavailable until autosave has a durable URL"} onClick={onCopyUrl}>Copy link</button>
        <button type="button" disabled={!isReady} onClick={onAnalyze}>Analyze</button>
        <button type="button" disabled={!isReady} onClick={onEdit}>Edit</button>
        <button type="button" disabled={!isReady} onClick={onAnimate}>Animate</button>
        {typeof navigator !== "undefined" && navigator.share ? (
          <button type="button" disabled={!shareable} title={shareable ? "Share image" : "Share unavailable until autosave has a durable URL"} onClick={onShare}>Share</button>
        ) : null}
      </div>
    </article>
  );
}
