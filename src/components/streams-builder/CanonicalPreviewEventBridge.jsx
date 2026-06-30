"use client";

import { useEffect } from "react";

const ACTIVE_KEY = "streams-ai:active-builder-preview";
const OPEN_EVENT = "streams:open-builder-preview";
const JOB_EVENTS = [
  "streams-builder:preview-source-ready",
  "streams-builder:job-complete-preview",
  "streams-builder:builder-job-complete",
  "streams-builder:runtime-job-complete",
  "streams-builder:artifact-ready",
];

function readActive() {
  try { return JSON.parse(window.sessionStorage.getItem(ACTIVE_KEY) || "{}"); } catch { return {}; }
}

function writeActive(value) {
  try { window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(value)); } catch {}
}

function sourceFromDetail(detail = {}) {
  return String(detail.previewHtml || detail.html || detail.sourceCode || detail.source || detail.code || "").trim();
}

function htmlFromArtifactUrl(detail = {}) {
  const url = detail.previewUrl || detail.artifactUrl || detail.outputUrl || detail.url || "";
  if (!url) return "";
  const name = String(detail.title || detail.name || "Builder output").replace(/[<>]/g, "");
  const isImage = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(url) || /^image\//i.test(String(detail.mimeType || ""));
  const body = isImage
    ? `<img src="${url}" alt="${name}" style="max-width:100%;height:auto;display:block;margin:0 auto"/>`
    : `<iframe src="${url}" title="${name}" style="width:100%;height:100vh;border:0;background:white"></iframe>`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;min-height:100vh;background:#fff;font-family:Inter,system-ui}.wrap{min-height:100vh;display:grid;place-items:center}</style></head><body><main class="wrap">${body}</main></body></html>`;
}

function previewPayload(detail = {}) {
  const source = sourceFromDetail(detail);
  const html = source || htmlFromArtifactUrl(detail);
  if (!html) return null;
  return {
    title: String(detail.title || detail.name || detail.prompt || "Streams Builder Preview").replace(/\s+/g, " ").trim().slice(0, 120),
    type: detail.type || detail.kind || (/<svg[\s>]/i.test(html) ? "svg" : "html"),
    sourceCode: detail.sourceCode || detail.source || detail.code || html,
    previewHtml: detail.previewHtml || detail.html || html,
    sessionId: detail.sessionId || readActive().sessionId || null,
    projectId: detail.projectId || null,
    metadata: {
      source: detail.source || "canonical-preview-event-bridge",
      reason: detail.reason || detail.eventType || "builder_event",
      builderRunId: detail.builderRunId || detail.jobId || detail.runId || "",
      artifactUrl: detail.artifactUrl || detail.outputUrl || detail.url || "",
      placeholder: false,
    },
  };
}

async function linkAssets(previewId, detail = {}) {
  const ids = Array.isArray(detail.assetIds) ? detail.assetIds : detail.assetId ? [detail.assetId] : [];
  const sessionId = detail.sessionId || readActive().sessionId || "";
  if (sessionId && !ids.length) {
    try {
      const response = await fetch(`/api/streams-ai/assets?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      const assets = Array.isArray(data.assets) ? data.assets : [];
      ids.push(...assets.map((asset) => asset.id).filter(Boolean));
    } catch {}
  }
  const linked = [];
  for (const assetId of ids.slice(0, 30)) {
    try {
      const response = await fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          sessionId: sessionId || null,
          projectId: detail.projectId || null,
          builderRunId: detail.builderRunId || detail.jobId || detail.runId || null,
          role: detail.assetRole || detail.role || "reference",
          metadata: { source: "canonical-preview-event-bridge" },
        }),
      });
      if (response.ok) linked.push(assetId);
    } catch {}
  }
  return linked;
}

async function patchSession(sessionId, metadata) {
  if (!sessionId) return;
  await fetch("/api/streams-ai/sessions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, metadata }),
  }).catch(() => {});
}

export default function CanonicalPreviewEventBridge() {
  useEffect(() => {
    async function handle(detail = {}) {
      const payload = previewPayload(detail);
      if (!payload) return;
      const active = readActive();
      const previewId = detail.previewId || active.previewId || "";
      const endpoint = previewId ? `/api/streams-builder/previews/${encodeURIComponent(previewId)}` : "/api/streams-builder/previews";
      const method = previewId ? "PATCH" : "POST";
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.preview?.id) return;
      const linkedAssetIds = await linkAssets(data.preview.id, detail);
      const next = {
        previewId: data.preview.id,
        sessionId: payload.sessionId || "",
        previewUrl: data.previewUrl,
        activeBuilderRunId: payload.metadata.builderRunId || active.activeBuilderRunId || "",
        activeAssetIds: linkedAssetIds,
        open: true,
      };
      writeActive(next);
      await patchSession(next.sessionId, {
        activePreviewId: next.previewId,
        activePreviewUrl: next.previewUrl,
        activeBuilderRunId: next.activeBuilderRunId,
        activeAssetIds: next.activeAssetIds,
      });
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { ...next, source: "builder", reason: payload.metadata.reason } }));
    }

    const listeners = JOB_EVENTS.map((name) => {
      const listener = (event) => handle(event.detail || {}).catch(() => {});
      window.addEventListener(name, listener);
      return [name, listener];
    });
    return () => listeners.forEach(([name, listener]) => window.removeEventListener(name, listener));
  }, []);
  return null;
}
