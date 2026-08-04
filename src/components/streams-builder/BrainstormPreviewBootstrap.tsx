"use client";

import { useEffect } from "react";
import { BRAINSTORM_PREVIEW_HTML, BRAINSTORM_PREVIEW_ID } from "@/lib/streams-builder/brainstorm-preview-samples";

const STORAGE_KEY = "streams-builder:active-file";
const PREVIEW_URL = "/streams-ai/streams-builder/sample-preview";

export default function BrainstormPreviewBootstrap() {
  useEffect(() => {
    let cancelled = false;

    function mountVisual() {
      if (cancelled) return;

      const mounted = {
        repo: "",
        branch: "",
        path: `generated/previews/${BRAINSTORM_PREVIEW_ID}.html`,
        folder: "generated/previews",
        sha: `frontend-visual-${BRAINSTORM_PREVIEW_ID}`,
        content: BRAINSTORM_PREVIEW_HTML,
        route: PREVIEW_URL,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mounted));
      window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: mounted }));
      window.dispatchEvent(new CustomEvent("streams-builder:preview-mounted", {
        detail: {
          previewId: BRAINSTORM_PREVIEW_ID,
          previewUrl: PREVIEW_URL,
          operationId: mounted.sha,
          targetPane: "builder-three-column-canvas",
          brainstorm: true,
          placeholder: true,
        },
      }));
      window.dispatchEvent(new CustomEvent("streams:open-builder-preview", {
        detail: {
          previewId: BRAINSTORM_PREVIEW_ID,
          previewUrl: PREVIEW_URL,
          lifecycleState: "ready",
          targetSurface: "builder",
          brainstorm: true,
          placeholder: true,
        },
      }));

      const entries = [
        ["frontend.visual.started", "Frontend visual placeholder started."],
        ["frontend.source.loaded", `Loaded ${BRAINSTORM_PREVIEW_HTML.length} characters of sample landing-page HTML into the Code Editor.`],
        ["frontend.preview.mounted", `Mounted visual preview at ${PREVIEW_URL}.`],
        ["frontend.preview.rendered", "Sample landing page rendered in Preview and Frontend UI."],
        ["frontend.devtools.connected", "DevTools connected to the sample visual preview."],
        ["frontend.visual.ready", "Frontend visual is ready for demonstration; no repository or branch is required."],
      ];

      for (const [phase, message] of entries) {
        const detail = {
          source: "hardcoded-frontend-visual",
          phase,
          message,
          previewId: BRAINSTORM_PREVIEW_ID,
          previewUrl: PREVIEW_URL,
          filePath: mounted.path,
          repo: "",
          branch: "",
          brainstorm: true,
          placeholder: true,
          at: new Date().toISOString(),
        };
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail }));
        window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail }));
      }
    }

    mountVisual();
    const retryOne = window.setTimeout(mountVisual, 250);
    const retryTwo = window.setTimeout(mountVisual, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(retryOne);
      window.clearTimeout(retryTwo);
    };
  }, []);

  return null;
}
