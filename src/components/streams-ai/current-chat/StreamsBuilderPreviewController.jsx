"use client";

import { useEffect, useRef } from "react";

const OPEN_EVENT = "streams:open-builder-preview";

function isPreviewable(text = "") {
  return /\b(build|preview|render|website|landing page|component|dashboard|card|app screen|frontend|html|react|jsx|tsx|svg|design|layout|visual)\b/i.test(String(text || ""));
}

function extractSource(text = "") {
  const value = String(text || "");
  const fenced = value.match(/```(?:html|tsx|jsx|react|javascript|js|typescript|ts|svg)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const start = value.search(/<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<svg[\s>]/i);
  return start >= 0 ? value.slice(start).trim() : "";
}

function previewHtmlFromSource(source = "", title = "Streams Preview") {
  const value = String(source || "").trim();
  if (/<!doctype html|<html[\s>]/i.test(value)) return value;
  if (/<svg[\s>]/i.test(value)) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090b12">${value}</body></html>`;
  if (/<[a-z][\s\S]*>/i.test(value) && !/export\s+default|className=/.test(value)) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${value}</body></html>`;
  const safe = value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char));
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui;background:#070b18;color:#f8fbff}main{width:min(760px,calc(100vw - 40px));border:1px solid rgba(255,255,255,.14);border-radius:28px;background:rgba(255,255,255,.08);padding:34px}pre{white-space:pre-wrap;color:#b8c7e8}</style></head><body><main><h1>${title}</h1><pre>${safe}</pre></main></body></html>`;
}

export default function StreamsBuilderPreviewController({ chatRuntime }) {
  const lastKey = useRef("");

  useEffect(() => {
    const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
    if (!messages.length || !chatRuntime?.sessionId) return;
    const latestAssistant = [...messages].reverse().find((message) => message?.role === "assistant" && String(message.content || "").trim());
    const latestUser = [...messages].reverse().find((message) => message?.role === "user" && String(message.content || "").trim());
    const source = extractSource(latestAssistant?.content || "");
    const shouldOpen = Boolean(source) || isPreviewable(latestUser?.content || "");
    if (!shouldOpen) return;
    const key = `${chatRuntime.sessionId}:${latestAssistant?.id || latestUser?.id || messages.length}:${source.slice(0, 80)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    async function createPreview() {
      const title = latestUser?.content ? String(latestUser.content).replace(/\s+/g, " ").trim().slice(0, 80) : "Streams Builder Preview";
      const previewHtml = source ? previewHtmlFromSource(source, title) : previewHtmlFromSource("", title);
      const response = await fetch("/api/streams-builder/previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type: source ? "html" : "placeholder", sessionId: chatRuntime.sessionId, sourceCode: source, previewHtml, metadata: { source: "streams-ai-auto-preview", reason: source ? "assistant-preview-source" : "previewable-user-request" } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.preview?.id) return;
      await fetch("/api/streams-ai/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: chatRuntime.sessionId, metadata: { activePreviewId: data.preview.id, activePreviewUrl: data.previewUrl, activeBuilderRunId: "", activeAssetIds: [] } }) }).catch(() => {});
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { previewId: data.preview.id, previewUrl: data.previewUrl, mode: "embedded", source: "chat", sessionId: chatRuntime.sessionId, reason: source ? "assistant_preview_source" : "previewable_request" } }));
    }
    createPreview().catch(() => {});
  }, [chatRuntime?.messages, chatRuntime?.sessionId]);

  return null;
}
