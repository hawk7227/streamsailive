"use client";

import { useEffect } from "react";

const ACTIVE_PREVIEW_KEY = "streams-ai:active-builder-preview";
const OPEN_PREVIEW_EVENT = "streams:open-builder-preview";

function readActivePreview() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(ACTIVE_PREVIEW_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function isOpenPreviewCommand(value: string) {
  return /^(?:please\s+)?(?:open|show|view|launch)\s+(?:the\s+|my\s+|your\s+|current\s+|active\s+)?preview[.!?\s]*$/i.test(value.trim());
}

export default function BuilderChatPreviewContextBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/streams-ai/messages") && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body);
          if (body?.metadata?.source === "streams-builder-connected-chat") {
            const preview = readActivePreview();
            const hasPreview = Boolean(preview.previewId || preview.previewUrl);
            body.metadata = {
              ...body.metadata,
              activePreviewId: preview.previewId || null,
              activePreviewUrl: preview.previewUrl || null,
              activeBuilderRunId: preview.activeBuilderRunId || null,
              activeAssetIds: Array.isArray(preview.activeAssetIds) ? preview.activeAssetIds : [],
              previewOpen: Boolean(preview.open),
            };
            if (hasPreview) {
              body.selectedContext = {
                type: "builder_preview",
                previewId: preview.previewId || null,
                previewUrl: preview.previewUrl || null,
                builderRunId: preview.activeBuilderRunId || null,
                instruction: "The user is referring to the currently active Streams Builder preview. Treat phrases such as this preview, my preview, the page, the screen, or open the preview as references to this active preview.",
              };
            }
          }
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          // Preserve the original request when it is not JSON.
        }
      }
      return originalFetch(input, init);
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.classList.contains("footerComposer")) return;
      const textarea = form.querySelector("textarea");
      if (!(textarea instanceof HTMLTextAreaElement) || !isOpenPreviewCommand(textarea.value)) return;

      const preview = readActivePreview();
      if (!preview.previewId && !preview.previewUrl) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      textarea.value = "";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      window.dispatchEvent(new CustomEvent(OPEN_PREVIEW_EVENT, {
        detail: { ...preview, open: true, source: "builder-chat-command", reason: "user_requested_preview" },
      }));
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
