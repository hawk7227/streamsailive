"use client";

import { useEffect, useRef } from "react";

const OPEN_EVENT = "streams:open-builder-preview";
const ACTIVE_KEY = "streams-ai:active-builder-preview";

function extractSource(text = "") {
  const value = String(text || "");
  const fenced = value.match(/```(?:html|tsx|jsx|react|javascript|js|typescript|ts|svg)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const start = value.search(/<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<svg[\s>]/i);
  return start >= 0 ? value.slice(start).trim() : "";
}

function previewHtmlFromSource(source = "") {
  const value = String(source || "").trim();
  if (/<!doctype html|<html[\s>]/i.test(value)) return value;
  if (/<svg[\s>]/i.test(value)) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090b12">${value}</body></html>`;
  if (/<[a-z][\s\S]*>/i.test(value) && !/export\s+default|className=/.test(value)) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${value}</body></html>`;
  return value;
}

function getSavedPreviewId(sessionId) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ACTIVE_KEY) || "{}");
    if (saved?.previewId && (!saved.sessionId || saved.sessionId === sessionId)) return saved.previewId;
  } catch {}
  return "";
}

async function linkSessionAssets(previewId, sessionId) {
  try {
    const response = await fetch(`/api/streams-ai/assets?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const assets = Array.isArray(data.assets) ? data.assets : [];
    await Promise.all(assets.slice(0, 20).map((asset) => fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, sessionId, role: asset.kind === "image" ? "source_image" : "reference", metadata: { source: "auto-link-session-assets" } }),
    }).catch(() => null)));
  } catch {}
}

export default function StreamsBuilderPreviewController({ chatRuntime }) {
  const lastKey = useRef("");

  useEffect(() => {
    const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
    if (!messages.length || !chatRuntime?.sessionId) return;
    const latestAssistant = [...messages].reverse().find((message) => message?.role === "assistant" && String(message.content || "").trim());
    const latestUser = [...messages].reverse().find((message) => message?.role === "user" && String(message.content || "").trim());
    const source = extractSource(latestAssistant?.content || "");
    if (!source) return;
    const key = `${chatRuntime.sessionId}:${latestAssistant?.id || messages.length}:${source.slice(0, 120)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    async function upsertPreview() {
      const title = latestUser?.content ? String(latestUser.content).replace(/\s+/g, " ").trim().slice(0, 80) : "Streams Builder Preview";
      const previewHtml = previewHtmlFromSource(source);
      const existingPreviewId = getSavedPreviewId(chatRuntime.sessionId);
      const url = existingPreviewId ? `/api/streams-builder/previews/${encodeURIComponent(existingPreviewId)}` : "/api/streams-builder/previews";
      const response = await fetch(url, {
        method: existingPreviewId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type: "html", sessionId: chatRuntime.sessionId, sourceCode: source, previewHtml, metadata: { source: "streams-ai-auto-preview", reason: "assistant-preview-source", placeholder: false } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.preview?.id) return;
      await linkSessionAssets(data.preview.id, chatRuntime.sessionId);
      try { window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ previewId: data.preview.id, sessionId: chatRuntime.sessionId, open: true })); } catch {}
      await fetch("/api/streams-ai/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: chatRuntime.sessionId, metadata: { activePreviewId: data.preview.id, activePreviewUrl: data.previewUrl, activeBuilderRunId: "", activeAssetIds: [] } }) }).catch(() => {});
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { previewId: data.preview.id, previewUrl: data.previewUrl, mode: "embedded", source: "chat", sessionId: chatRuntime.sessionId, reason: "assistant_preview_source" } }));
    }
    upsertPreview().catch(() => {});
  }, [chatRuntime?.messages, chatRuntime?.sessionId]);

  return null;
}
