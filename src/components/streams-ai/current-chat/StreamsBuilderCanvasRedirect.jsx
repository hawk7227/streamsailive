"use client";

import { useEffect } from "react";

const OPEN_EVENT = "streams:open-builder-preview";
const CANVAS_EVENT = "streams:builder-canvas-open";
const ACTIVE_KEY = "streams-ai:active-builder-preview";
const ACTIVE_FILE_KEY = "streams-builder:active-file";

function normalizePreview(detail = {}) {
  const previewId = String(detail.previewId || "").trim();
  const previewUrl = String(
    detail.previewUrl || (previewId ? `/streams-builder/preview/${previewId}` : ""),
  ).trim();
  if (!previewId || !previewUrl) return null;

  return {
    previewId,
    previewUrl,
    operationId: String(
      detail.operationId || detail.activeBuilderRunId || previewId,
    ).trim(),
    sessionId: String(detail.sessionId || "").trim(),
  };
}

function openBuilderCanvas(detail = {}) {
  const preview = normalizePreview(detail);
  if (!preview) return;

  const activeFile = {
    repo: "hawk7227/streamsailive",
    branch: "runtime-preview",
    path: `generated/previews/${preview.previewId}.html`,
    folder: "generated/previews",
    sha: preview.operationId,
    content: "",
    route: preview.previewUrl,
  };

  const next = {
    ...detail,
    ...preview,
    open: true,
    handedOff: true,
    handedOffAt: new Date().toISOString(),
    targetPane: "research-builder-canvas",
  };

  try {
    window.localStorage.setItem(ACTIVE_FILE_KEY, JSON.stringify(activeFile));
    window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(next));
  } catch {}

  // Do not navigate and do not mount a second chat. The current authoritative
  // conversation remains mounted and simply narrows to the left while the
  // researched Builder canvas opens beside it.
  window.dispatchEvent(new CustomEvent(CANVAS_EVENT, { detail: next }));
}

export default function StreamsBuilderCanvasRedirect() {
  useEffect(() => {
    const onOpen = (event) => openBuilderCanvas(event?.detail || {});
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return null;
}
