"use client";

import { useEffect } from "react";

const DEFAULT_PREVIEW_ID = "bc0609ba-27f7-4a58-823b-f36754ec8ea5";

export default function DefaultBrainstormPreviewInitializer() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("previewId")) return;

    let hasUsableActiveFile = false;
    try {
      const raw = window.localStorage.getItem("streams-builder:active-file");
      const activeFile = raw ? JSON.parse(raw) : null;
      hasUsableActiveFile = Boolean(activeFile?.path && String(activeFile?.content || "").trim());
    } catch {
      hasUsableActiveFile = false;
    }

    if (hasUsableActiveFile) return;

    url.searchParams.set("previewId", DEFAULT_PREVIEW_ID);
    url.searchParams.set("mode", "brainstorm");
    window.location.replace(url.toString());
  }, []);

  return null;
}
