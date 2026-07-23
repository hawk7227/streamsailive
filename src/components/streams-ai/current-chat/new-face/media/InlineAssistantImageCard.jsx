import "./inline-assistant-image-card.css";
import "../composer/streams-console-color-system-fixes.css";

export default function InlineAssistantImageCard({
  image,
  onLoaded,
  onOpen,
  onCopy,
  onCopyUrl,
  onSave,
  onDownload,
  onShare,
  onEdit,
}) {
  const mediaSrc = image?.partialUrl || image?.url || "";
  const visualStatus = image?.status === "ready" || image?.status === "completed"
    ? "success"
    : image?.status === "failed" || image?.status === "error"
      ? "error"
      : "working";
  const statusText = image?.status === "failed" || image?.status === "error"
    ? image?.statusText || "Image generation failed"
    : image?.statusText || "Generating image…";
  const copyHandler = onCopy || onCopyUrl;
  const saveHandler = onSave || onDownload;

  if (!mediaSrc) {
    return <div className="streamsInlineMediaPending" role="status" aria-live="polite">{statusText}</div>;
  }

  return (
    <figure
      className="streamsInlineMedia streamsInlineImage inlineAssistantImageCard"
      data-feature="image"
      data-status={visualStatus}
    >
      <button type="button" className="streamsInlineMediaSurface" onClick={onOpen} aria-label="Open generated image">
        <img
          src={mediaSrc}
          alt={image?.alt || image?.prompt || "Generated image"}
          className="inlineAssistantImage"
          onLoad={(event) => {
            const target = event.currentTarget;
            onLoaded?.({ width: target.naturalWidth, height: target.naturalHeight });
          }}
        />
      </button>
      <div className="streamsInlineMediaActions" aria-label="Image actions">
        {onEdit ? <button type="button" onClick={onEdit}>Edit</button> : null}
        {saveHandler ? <button type="button" onClick={saveHandler}>Save</button> : null}
        {copyHandler ? <button type="button" onClick={copyHandler}>Copy</button> : null}
        {onShare ? <button type="button" onClick={onShare}>Share</button> : null}
      </div>
    </figure>
  );
}
