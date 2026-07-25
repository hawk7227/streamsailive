"use client";

import { useEffect } from "react";

const OPEN_EVENT = "streams:open-builder-preview";
const ACTIVE_KEY = "streams-ai:active-builder-preview";
const ACTIVE_FILE_KEY = "streams-builder:active-file";

function normalizePreview(detail = {}) {
  const previewId = String(detail.previewId || "").trim();
  const previewUrl = String(
    detail.previewUrl || (previewId ? `/streams-builder/preview/${previewId}` : ""),
  ).trim();
  if (!previewId || !previewUrl) return null;

  const operationId = String(
    detail.operationId || detail.activeBuilderRunId || previewId,
  ).trim();

  return {
    previewId,
    previewUrl,
    operationId,
    sessionId: String(detail.sessionId || "").trim(),
  };
}

function openBuilderCanvas(detail = {}) {
  const preview = normalizePreview(detail);
  if (!preview) return;

  const activeFile = {
    repo: "generated/runtime-preview",
    branch: "runtime",
    path: `generated/previews/${preview.previewId}.html`,
    folder: "generated/previews",
    sha: preview.operationId,
    content: "",
    route: preview.previewUrl,
  };

  try {
    window.localStorage.setItem(ACTIVE_FILE_KEY, JSON.stringify(activeFile));
    window.sessionStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({ ...detail, ...preview, open: true, targetPane: "frontend" }),
    );
  } catch {}

  const query = new URLSearchParams();
  if (preview.sessionId) query.set("sessionId", preview.sessionId);
  query.set("previewId", preview.previewId);
  const destination = `/streams-ai/streams-builder?${query.toString()}`;

  if (`${window.location.pathname}${window.location.search}` !== destination) {
    window.location.assign(destination);
  }
}

export default function StreamsBuilderCanvasRedirect() {
  useEffect(() => {
    const onOpen = (event) => openBuilderCanvas(event?.detail || {});
    window.addEventListener(OPEN_EVENT, onOpen);

    try {
      const active = JSON.parse(window.sessionStorage.getItem(ACTIVE_KEY) || "{}");
      if (active?.previewId && active?.open) {
        window.setTimeout(() => openBuilderCanvas(active), 0);
      }
    } catch {}

    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return null;
}
