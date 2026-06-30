"use client";

import { useEffect, useRef } from "react";

const OPEN_EVENT = "streams:open-builder-preview";
const ACTIVE_KEY = "streams-ai:active-builder-preview";
const EDIT_FOLLOWUP = /\b(make|change|update|edit|fix|adjust|resize|move|add|remove|replace|use|apply|turn|show|open|render|preview)\b/i;

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

function getActiveState(sessionId) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ACTIVE_KEY) || "{}");
    if (saved?.previewId && (!saved.sessionId || saved.sessionId === sessionId)) return saved;
  } catch {}
  return {};
}

function setActiveState(value) {
  try { window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(value)); } catch {}
}

async function linkSessionAssets(previewId, sessionId) {
  const linked = [];
  try {
    const response = await fetch(`/api/streams-ai/assets?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const assets = Array.isArray(data.assets) ? data.assets : [];
    await Promise.all(assets.slice(0, 30).map(async (asset) => {
      const role = asset.kind === "image" ? "source_image" : /pdf|document/i.test(String(asset.mimeType || asset.mime_type || asset.kind || "")) ? "document" : "reference";
      const result = await fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, sessionId, role, metadata: { source: "auto-link-session-assets" } }),
      }).catch(() => null);
      if (result?.ok) linked.push(asset.id);
    }));
  } catch {}
  return linked;
}

async function fetchActivePreviewContext(sessionId) {
  const active = getActiveState(sessionId);
  if (!active.previewId) return "";
  try {
    const response = await fetch(`/api/streams-builder/previews/${encodeURIComponent(active.previewId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false || !data?.preview) return "";
    const preview = data.preview || {};
    const assets = Array.isArray(data.assets) ? data.assets : [];
    return [
      "[Active Streams Builder Preview]",
      `previewId: ${preview.id}`,
      `previewUrl: /streams-builder/preview/${preview.id}`,
      `title: ${preview.title || ""}`,
      `type: ${preview.type || "html"}`,
      `status: ${preview.status || "ready"}`,
      `linkedAssets: ${assets.map((row) => `${row.role || "reference"}:${row.asset_id || row.asset?.id || ""}`).filter(Boolean).join(", ") || "none"}`,
      "Current preview source:",
      String(preview.source_code || preview.preview_html || "").slice(0, 60000),
      "[/Active Streams Builder Preview]",
      "When the user asks for a visual/layout/design/edit/follow-up change, update this active preview. Return the complete updated renderable source in one fenced html code block so Streams can PATCH the same preview record. Do not only describe the change.",
    ].join("\n");
  } catch {
    return "";
  }
}

function installActivePreviewEditBridge(chatRuntime) {
  if (typeof window === "undefined") return () => {};
  if (window.__streamsActivePreviewEditBridgeInstalled) return () => {};
  const originalFetch = window.fetch.bind(window);
  window.__streamsActivePreviewEditBridgeInstalled = true;
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "POST" && url === "/api/streams-ai/messages" && init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        const message = String(body?.message || body?.input || body?.prompt || body?.text || body?.content || "").trim();
        const sessionId = body?.sessionId || chatRuntime?.sessionId || getActiveState(chatRuntime?.sessionId).sessionId || "";
        const active = getActiveState(sessionId);
        if (active.previewId && EDIT_FOLLOWUP.test(message)) {
          const previewContext = await fetchActivePreviewContext(sessionId);
          if (previewContext) {
            const headers = new Headers(init.headers || {});
            headers.set("Content-Type", "application/json");
            return originalFetch(input, {
              ...init,
              headers,
              body: JSON.stringify({ ...body, message: `${message}\n\n${previewContext}`, activePreviewId: active.previewId, activePreviewUrl: active.previewUrl || `/streams-builder/preview/${active.previewId}` }),
            });
          }
        }
      } catch {}
    }
    return originalFetch(input, init);
  };
  return () => { window.fetch = originalFetch; window.__streamsActivePreviewEditBridgeInstalled = false; };
}

export default function StreamsBuilderPreviewController({ chatRuntime }) {
  const lastKey = useRef("");

  useEffect(() => installActivePreviewEditBridge(chatRuntime), [chatRuntime?.sessionId]);

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
      const active = getActiveState(chatRuntime.sessionId);
      const existingPreviewId = active.previewId || "";
      const url = existingPreviewId ? `/api/streams-builder/previews/${encodeURIComponent(existingPreviewId)}` : "/api/streams-builder/previews";
      const response = await fetch(url, {
        method: existingPreviewId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type: "html", sessionId: chatRuntime.sessionId, sourceCode: source, previewHtml, metadata: { source: "streams-ai-auto-preview", reason: existingPreviewId ? "active-preview-follow-up" : "assistant-preview-source", placeholder: false, activeBuilderRunId: active.activeBuilderRunId || "" } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.preview?.id) return;
      const activeAssetIds = await linkSessionAssets(data.preview.id, chatRuntime.sessionId);
      const nextActive = { previewId: data.preview.id, sessionId: chatRuntime.sessionId, previewUrl: data.previewUrl, activeBuilderRunId: active.activeBuilderRunId || "", activeAssetIds, open: true };
      setActiveState(nextActive);
      await fetch("/api/streams-ai/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: chatRuntime.sessionId, metadata: { activePreviewId: data.preview.id, activePreviewUrl: data.previewUrl, activeBuilderRunId: nextActive.activeBuilderRunId, activeAssetIds } }) }).catch(() => {});
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { ...nextActive, mode: "embedded", source: "chat", reason: existingPreviewId ? "active_preview_follow_up" : "assistant_preview_source" } }));
    }
    upsertPreview().catch(() => {});
  }, [chatRuntime?.messages, chatRuntime?.sessionId]);

  return null;
}
