"use client";

import { useEffect, useState } from "react";
import StreamsWorkspaceShell from "./new-face/StreamsWorkspaceShell";
import StreamsCleanSidebar from "./new-face/sidebar/StreamsCleanSidebar";
import SnapPicClickCapture from "./new-face/capture/SnapPicClickCapture";
import { isAdminBrowserToolIntent, runAdminBrowserTool } from "./runtime/adminBrowserToolsClient";

const LIBRARY_KEY = "streams.library.files.v1";

function encodeSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function readLibraryFiles() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLibraryFiles(files) {
  const seen = new Set();
  const unique = files.filter((file) => {
    const key = file?.id || file?.storageUrl || file?.previewUrl || file?.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 250);
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event("streams:videos-changed"));
  window.dispatchEvent(new Event("streams:images-changed"));
}

function upsertLibraryAssets(assets = []) {
  if (!assets.length || typeof window === "undefined") return;
  writeLibraryFiles([...assets, ...readLibraryFiles()]);
  window.dispatchEvent(new CustomEvent("streams:chat-upload-complete", { detail: { assets } }));
}

function normalizeAsset(asset = {}) {
  const url = asset.storageUrl || asset.previewUrl || asset.publicUrl || asset.url || "";
  return {
    ...asset,
    id: asset.id || url || asset.name,
    kind: asset.kind || (String(asset.mimeType || "").startsWith("image/") ? "image" : String(asset.mimeType || "").startsWith("video/") ? "video" : "file"),
    name: asset.name || "Uploaded file",
    storageUrl: asset.storageUrl || url,
    previewUrl: asset.previewUrl || url,
    url,
  };
}

function recentReadableFileContext() {
  if (typeof window === "undefined") return "";
  const readable = readLibraryFiles().filter((file) => String(file?.textPreview || "").trim()).slice(0, 4);
  if (!readable.length) return "";
  return readable.map((file, index) => {
    const text = String(file.textPreview || "").slice(0, 12000);
    const truncated = file.textTruncated ? "\n[File preview truncated]" : "";
    return `Uploaded file ${index + 1}: ${file.name || file.id}\nMIME: ${file.mimeType || "unknown"}\nSize: ${file.sizeBytes || 0} bytes\n\n${text}${truncated}`;
  }).join("\n\n---\n\n");
}

function latestUploadedImageAsset() {
  if (typeof window === "undefined") return null;
  return readLibraryFiles().map(normalizeAsset).find((file) => {
    const mime = String(file.mimeType || "").toLowerCase();
    return file.url && (file.kind === "image" || mime.startsWith("image/"));
  }) || null;
}

function wantsImageToVideoFromPrompt(message = "") {
  const text = String(message || "").toLowerCase();
  if (!text.trim()) return false;
  return (
    /(this|uploaded|reference|image|photo|picture|portrait|it)[\s\S]{0,80}(video|move|moving|motion|animate|animation|cinematic)/.test(text) ||
    /(turn|make|create|generate|animate)[\s\S]{0,80}(this|uploaded|reference|image|photo|picture|portrait|it)/.test(text) ||
    /image\s*to\s*video/.test(text)
  );
}

async function uploadSelectedFiles(files) {
  const selected = Array.from(files || []);
  if (!selected.length) return [];
  const form = new FormData();
  selected.forEach((file) => form.append("file", file));
  const response = await fetch("/api/streams-ai/assets", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.error || "Upload failed");
  }
  const assets = (Array.isArray(data.assets) ? data.assets : Array.isArray(data.files) ? data.files : []).map(normalizeAsset);
  upsertLibraryAssets(assets);
  return assets;
}

function installComposerUploadBridge() {
  if (typeof window === "undefined") return () => {};
  if (window.__streamsComposerUploadBridgeInstalled) return () => {};
  window.__streamsComposerUploadBridgeInstalled = true;
  const onChange = (event) => {
    const input = event.target;
    if (!input || input.tagName !== "INPUT" || input.type !== "file") return;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    uploadSelectedFiles(files).catch((error) => console.error("[streams-upload-bridge]", error));
    input.value = "";
  };
  window.addEventListener("change", onChange, true);
  return () => {
    window.removeEventListener("change", onChange, true);
    window.__streamsComposerUploadBridgeInstalled = false;
  };
}

function isStudioToolListIntent(message) {
  const text = String(message || "").trim().toLowerCase();
  return text === "studio.tools" || text === "studio tools" || text === "streams.capabilities" || text === "streams capabilities" || text.includes("list studio tools") || text.includes("what studio tools") || text.includes("what can studio do") || text.includes("show studio tools") || text.includes("what can streams do") || text.includes("what capabilities") || text.includes("all capabilities") || text.includes("all tools");
}

function formatStudioTools(tools = []) {
  const lines = tools.map((tool) => `- ${tool.title} (${tool.id}) — ${String(tool.status || "unknown").replace(/_/g, " ").toUpperCase()}`);
  return ["Studio tools available to Chat:", "", ...lines, "", "Wired now: Image Generation and Text to Video use the existing proven STREAMS provider paths.", "Image to Video is exposed but requires an imageUrl. Other cards stay blocked until their real provider paths are wired.", "Open /studio to use the Studio surface directly."].join("\n");
}

async function getCapabilitiesText(originalFetch) {
  const response = await originalFetch("/api/streams-ai/tools", { cache: "no-store" });
  const data = await response.json();
  return data?.text || formatStudioTools(data?.capabilities || []);
}

function makeSseResponse(text, mode = "admin-browser") {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSseEvent("activity", { phase: "tool", mode, statusText: mode === "studio-tools" ? "Reading Studio tools…" : "Running admin browser tool…", startedAt })));
      controller.enqueue(encoder.encode(encodeSseEvent("response", { token: text })));
      controller.enqueue(encoder.encode(encodeSseEvent("complete", { elapsedMs: Date.now() - startedAt, mode, messageLength: text.length })));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}

function parseChatBody(init) {
  try { return init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {}; } catch { return {}; }
}

function stringifyChatBody(body) {
  try { return JSON.stringify(body); } catch { return "{}"; }
}

function appendFileContextToMessage(body) {
  const fileContext = recentReadableFileContext();
  if (!fileContext) return body;
  const direct = body?.message || body?.input || body?.prompt || body?.text || body?.content || "";
  const existing = String(direct || "").trim();
  const contextBlock = `\n\n[Uploaded file context available to answer the user]\n${fileContext}\n[/Uploaded file context]`;
  return { ...body, message: `${existing}${contextBlock}`, file: true, uploadedFileContext: fileContext };
}

function attachLatestImageToVideoBody(body = {}) {
  if (body.imageUrl || body.mode === "i2v") return body;
  const prompt = body.prompt || body.message || "";
  if (!wantsImageToVideoFromPrompt(prompt)) return body;
  const image = latestUploadedImageAsset();
  if (!image?.url) return body;
  return { ...body, mode: "i2v", imageUrl: image.url, method: body.method || "image_to_video", workflow: body.workflow || "image_to_video", sourceAssetId: image.id, sourceAssetName: image.name };
}

function installAdminBrowserToolFetchBridge() {
  if (typeof window === "undefined") return () => {};
  if (window.__streamsAdminBrowserToolFetchBridgeInstalled) return () => {};
  const originalFetch = window.fetch.bind(window);
  window.__streamsAdminBrowserToolFetchBridgeInstalled = true;
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || "GET").toUpperCase();
    if (method === "POST" && url === "/api/streams-ai/tools") {
      const body = parseChatBody(init);
      const nextBody = attachLatestImageToVideoBody(body);
      return originalFetch(input, { ...init, headers: { ...(init?.headers || {}), "Content-Type": "application/json" }, body: stringifyChatBody(nextBody) });
    }
    if (method === "POST" && url === "/api/streams-ai/messages") {
      const body = parseChatBody(init);
      const message = String(body?.message || body?.input || body?.prompt || body?.text || body?.content || "").trim();
      if (isStudioToolListIntent(message)) {
        try { return makeSseResponse(await getCapabilitiesText(originalFetch), "studio-tools"); } catch (error) { return makeSseResponse(`Studio tools failed: ${error?.message || "Unknown error"}`, "studio-tools"); }
      }
      if (isAdminBrowserToolIntent(message)) {
        try { const result = await runAdminBrowserTool(message); return makeSseResponse(result.responseText || `${result.tool} completed.`, "admin-browser"); } catch (error) { return makeSseResponse(`Admin browser tool failed: ${error?.message || "Unknown error"}`, "admin-browser"); }
      }
      const nextBody = appendFileContextToMessage(body);
      return originalFetch(input, { ...init, headers: { ...(init?.headers || {}), "Content-Type": "application/json" }, body: stringifyChatBody(nextBody) });
    }
    return originalFetch(input, init);
  };
  return () => { window.fetch = originalFetch; window.__streamsAdminBrowserToolFetchBridgeInstalled = false; };
}

export default function StreamsClientShell() {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => setMounted(true), []);
  useEffect(() => installAdminBrowserToolFetchBridge(), []);
  useEffect(() => installComposerUploadBridge(), []);
  if (!mounted) return <main aria-label="Streams loading" style={{ minHeight: "100dvh", background: "#fff" }} />;
  return <><StreamsWorkspaceShell /><StreamsCleanSidebar open={sidebarOpen} setOpen={setSidebarOpen} /><SnapPicClickCapture /></>;
}
