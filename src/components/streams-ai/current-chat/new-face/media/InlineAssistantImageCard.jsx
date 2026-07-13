import { useMemo } from "react";
import "./inline-assistant-image-card.css";
import "../composer/streams-console-color-system-fixes.css";

function formatSizeLabel(image) {
  if (image?.width && image?.height) return `${image.width} × ${image.height}`;
  if (image?.requestSizeLabel) return image.requestSizeLabel;
  if (image?.sizeLabel) return image.sizeLabel;
  return "";
}

function normalizeVisualStatus(status) {
  if (status === "ready" || status === "completed") return "success";
  if (status === "failed" || status === "error") return "error";
  return "working";
}

function normalizeAspectRatio(value) {
  const match = String(value || "1:1").match(/^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
  if (!match) return "1 / 1";
  return `${match[1]} / ${match[2]}`;
}

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
  const sizeLabel = useMemo(() => formatSizeLabel(image), [image]);
  const visualStatus = normalizeVisualStatus(image?.status);
  const statusText =
    image?.status === "streaming"
      ? image?.statusText || "Generating image…"
      : image?.status === "ready" || image?.status === "completed"
        ? sizeLabel || "Image ready"
        : image?.status === "failed" || image?.status === "error"
          ? image?.statusText || "Image generation failed"
          : image?.statusText || "Preparing image…";
  const copyHandler = onCopy || onCopyUrl;
  const saveHandler = onSave || onDownload;

  return (
    <div
      className="inlineAssistantImageCard"
      data-feature="image"
      data-status={visualStatus}
      aria-busy={visualStatus === "working" ? "true" : "false"}
      style={{ "--streams-image-aspect-ratio": normalizeAspectRatio(image?.aspectRatio) }}
    >
      <div className="inlineAssistantImageCardFrame">
        {mediaSrc ? (
          <img
            src={mediaSrc}
            alt={image?.alt || image?.prompt || "Generated image"}
            className="inlineAssistantImage"
            onLoad={(event) => {
              const target = event.currentTarget;
              onLoaded?.({
                width: target.naturalWidth,
                height: target.naturalHeight,
              });
            }}
          />
        ) : (
          <div className="inlineAssistantImageSkeleton">
            <div className="inlineAssistantImageDots" aria-hidden="true" />
            <div className="inlineAssistantImageSkeletonLabel">Generating a detailed image — hang tight.</div>
          </div>
        )}
      </div>

      <div className="inlineAssistantImageMetaRow">
        <div className="inlineAssistantImageMetaLeft">
          <span className="inlineAssistantImageStatus" role="status" aria-live="polite" aria-atomic="true">
            {statusText}
          </span>
          {sizeLabel ? <span className="inlineAssistantImageSize">{sizeLabel}</span> : null}
        </div>

        <div className="inlineAssistantImageActions">
          <button type="button" disabled={!onOpen || !mediaSrc} onClick={onOpen}>Open</button>
          <button type="button" disabled={!copyHandler || !mediaSrc} onClick={copyHandler}>Copy</button>
          <button type="button" disabled={!saveHandler || !mediaSrc} onClick={saveHandler}>Save</button>
          <button type="button" disabled={!onShare || !mediaSrc} onClick={onShare}>Share</button>
          <button type="button" disabled={!onEdit || !mediaSrc} onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}
