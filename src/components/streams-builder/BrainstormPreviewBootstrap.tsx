"use client";

import { useEffect } from "react";
import { BRAINSTORM_PREVIEW_HTML, BRAINSTORM_PREVIEW_ID } from "@/lib/streams-builder/brainstorm-preview-samples";

const STORAGE_KEY = "streams-builder:active-file";

function previewIdFromValue(value: string) {
  return value.match(/bc0609ba-27f7-4a58-823b-f36754ec8ea5/i)?.[0] || "";
}

export default function BrainstormPreviewBootstrap() {
  useEffect(() => {
    let current: Record<string, unknown> = {};
    try { current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"); } catch {}

    const currentId = previewIdFromValue(String(current.path || current.route || current.sha || ""));
    const queryId = new URLSearchParams(window.location.search).get("previewId") || "";
    const shouldMount = currentId === BRAINSTORM_PREVIEW_ID || queryId === BRAINSTORM_PREVIEW_ID || (!String(current.content || "").trim() && String(current.path || "").includes("generated/previews/"));
    if (!shouldMount) return;

    const previewUrl = `/streams-builder/preview/${BRAINSTORM_PREVIEW_ID}`;
    const mounted = {
      repo: "",
      branch: "",
      path: `generated/previews/${BRAINSTORM_PREVIEW_ID}.html`,
      folder: "generated/previews",
      sha: `brainstorm-${BRAINSTORM_PREVIEW_ID}`,
      content: BRAINSTORM_PREVIEW_HTML,
      route: previewUrl,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mounted));
    window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: mounted }));
    window.dispatchEvent(new CustomEvent("streams-builder:preview-mounted", { detail: { previewId: BRAINSTORM_PREVIEW_ID, previewUrl, operationId: mounted.sha, targetPane: "builder-three-column-canvas", brainstorm: true } }));

    const entries = [
      ["brainstorm.source.loaded", `Loaded ${BRAINSTORM_PREVIEW_HTML.length} characters of brainstorm HTML into the code editor.`],
      ["brainstorm.preview.mounted", `Mounted ${previewUrl} without a repository or branch.`],
      ["brainstorm.preview.ready", "Landing-page source is available to Preview, Code Editor, Logs, DevTools, and Frontend UI."],
    ];
    for (const [phase, message] of entries) {
      const detail = { source: "brainstorm-preview-bootstrap", phase, message, previewId: BRAINSTORM_PREVIEW_ID, previewUrl, filePath: mounted.path, repo: "", branch: "", brainstorm: true, at: new Date().toISOString() };
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail }));
      window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail }));
    }
  }, []);

  return null;
}
