import { useMemo } from "react";
import "./inline-assistant-image-card.css";

function formatSizeLabel(image) {
  if (image?.width && image?.height) return `${image.width} × ${image.height}`;
  if (image?.requestSizeLabel) return image.requestSizeLabel;
  if (image?.sizeLabel) return image.sizeLabel;
  return "";
}

export default function InlineAssistantImageCard({
  image,
  onLoaded,
  onOpen,
  onCopy,
  onSave,
  onShare,
  onEdit,
}) {
  const mediaSrc = image?.partialUrl || image?.url || "";
  const sizeLabel = useMemo(() => formatSizeLabel(image), [image]);
  const statusText =
    image?.status === "streaming"
      ? image?.statusText || "Generating image…"
      : image?.status === "ready"
        ? sizeLabel || "Image ready"
        : image?.statusText || "Preparing image…";

  return (
    <div className="inlineAssistantImageCard">
      <div className="inlineAssistantImageCardFrame">
        {mediaSrc ? (
          <img
            src={mediaSrc}
            alt={image?.alt || "Generated image"}
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
            <div className="inlineAssistantImageSkeletonLabel">{statusText}</div>
          </div>
        )}
      </div>

      <div className="inlineAssistantImageMetaRow">
        <div className="inlineAssistantImageMetaLeft">
          <span className="inlineAssistantImageStatus">{statusText}</span>
          {sizeLabel ? (
            <span className="inlineAssistantImageSize">{sizeLabel}</span>
          ) : null}
        </div>

        <div className="inlineAssistantImageActions">
          <button type="button" onClick={onOpen}>Open</button>
          <button type="button" onClick={onCopy}>Copy</button>
          <button type="button" onClick={onSave}>Save</button>
          <button type="button" onClick={onShare}>Share</button>
          <button type="button" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}
