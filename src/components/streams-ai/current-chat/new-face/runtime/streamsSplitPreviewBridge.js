export const STREAMS_SPLIT_PREVIEW_EVENT = "streams:split-preview";

export function openStreamsSplitPreview(payload = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, {
      detail: {
        action: "open",
        id: payload.id || `preview_${Date.now()}`,
        title: payload.title || "Preview",
        kind: payload.kind || "html",
        sourceVisible: Boolean(payload.sourceVisible),
        conversationCodeSuppressed: payload.conversationCodeSuppressed !== false,
        previewPanelOpen: true,
        sourceCode: payload.sourceCode || "",
        previewHtml: payload.previewHtml || "",
        repoFullName: payload.repoFullName || "",
        branch: payload.branch || "",
        filePath: payload.filePath || "",
        fileSha: payload.fileSha || "",
      },
    })
  );
}

export function closeStreamsSplitPreview() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, {
      detail: {
        action: "close",
      },
    })
  );
}

export function updateStreamsSplitPreview(payload = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, {
      detail: {
        action: "update",
        ...payload,
      },
    })
  );
}

export function subscribeToStreamsSplitPreview(listener) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => {
    listener(event.detail || {});
  };

  window.addEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
  return () => window.removeEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
}

export function isPreviewOnlyRequest(text = "") {
  return /\b(show in preview|preview only|render it|visual only|frontend only|hide code|no code in conversation|open preview|split preview)\b/i.test(
    String(text || "")
  );
}
