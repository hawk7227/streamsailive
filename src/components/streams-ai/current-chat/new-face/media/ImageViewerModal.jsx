import { useMemo, useState } from "react";
import "./inline-assistant-image-card.css";

function pushHistory(history, patch) {
  const next = [...history.slice(0, history.index + 1), patch];
  return {
    stack: next,
    index: next.length - 1,
  };
}

export default function ImageViewerModal({
  image,
  open,
  onClose,
  onSave,
}) {
  const [history, setHistory] = useState({
    stack: [{ tool: "select", aspectRatio: "free" }],
    index: 0,
  });

  const current = history.stack[history.index] || { tool: "select", aspectRatio: "free" };

  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;

  const sizeLabel = useMemo(() => {
    if (!image) return "";
    if (image.width && image.height) return `${image.width} × ${image.height}`;
    return image.requestSizeLabel || image.sizeLabel || "";
  }, [image]);

  if (!open || !image) return null;

  return (
    <div className="imageViewerOverlay" role="dialog" aria-modal="true">
      <div className="imageViewerShell">
        <div className="imageViewerToolbar">
          <button type="button" onClick={() => {
            setHistory((value) =>
              pushHistory(value, { ...current, tool: "select" })
            );
          }}>Select</button>

          <select
            value={current.aspectRatio}
            onChange={(event) => {
              setHistory((value) =>
                pushHistory(value, { ...current, aspectRatio: event.target.value })
              );
            }}
          >
            <option value="free">Aspect ratio</option>
            <option value="1:1">1:1</option>
            <option value="4:5">4:5</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>

          <button
            type="button"
            disabled={!canUndo}
            onClick={() => setHistory((value) => ({ ...value, index: value.index - 1 }))}
          >
            Undo
          </button>

          <button
            type="button"
            disabled={!canRedo}
            onClick={() => setHistory((value) => ({ ...value, index: value.index + 1 }))}
          >
            Redo
          </button>

          <div className="imageViewerSpacer" />

          <button type="button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            onClick={() => {
              onSave?.({
                ...image,
                editState: current,
              });
              onClose?.();
            }}
          >
            Save
          </button>
        </div>

        <div className="imageViewerHeader">
          <div className="imageViewerTitle">Image</div>
          <div className="imageViewerSubtitle">{sizeLabel}</div>
        </div>

        <div className="imageViewerCanvas">
          <img src={image.url} alt={image.alt || "Generated image"} className="imageViewerImage" />
        </div>
      </div>
    </div>
  );
}
