"use client";

import { useEffect, useState } from "react";
import StreamsOperatorShell from "../visual-operator/StreamsOperatorShell";
import { useStreamsChatRuntime } from "./new-face/hooks/useStreamsChatRuntime";
import ActualRecentChatsOverlay from "./ActualRecentChatsOverlay";
import ThreadAssetsHydrator from "./ThreadAssetsHydrator";
import StreamingRecoveryBanner from "./StreamingRecoveryBanner";
import MemoryControlsPanel from "./MemoryControlsPanel";
import StreamsAIComposerParityBridge from "./StreamsAIComposerParityBridge";
import StreamsAIStatusBridge from "./StreamsAIStatusBridge";
import StreamsAIInlineActivityBridge from "./StreamsAIInlineActivityBridge";
import { isAdminBrowserToolIntent, runAdminBrowserTool } from "./runtime/adminBrowserToolsClient";
import { useAuth } from "@/contexts/AuthContext";

const LIBRARY_KEY = "streams-ai.assets.cache.v1";

const PUBLIC_STREAMS_CAPABILITY_TEXT = `I’m STREAMS AI — a ChatGPT/Claude-style AI assistant platform for chat, writing, research, uploads, generation, coding help, tools, and AI workspaces.

I can help you ask questions, understand topics, write and rewrite content, upload and analyze files, summarize documents, research ideas, generate creative outputs, plan projects, get coding help, and continue work inside organized AI-powered workspaces.

What I can help with:

- General questions and natural conversation across a wide range of topics.
- Writing, rewriting, proofreading, emails, messages, captions, posts, scripts, reports, summaries, proposals, bios, descriptions, outlines, hooks, and long-form content.
- File and document intelligence including reading uploads, summarizing PDFs, extracting key points, answering questions from documents, comparing files, reviewing screenshots, and turning notes into finished work.
- Research and explanation including breaking down complex topics, comparing options, creating summaries, building study guides, and helping users understand documents, topics, and decisions.
- Creative generation including image ideas, image generation workflows, image editing requests, video prompts, storyboards, creative direction, visual references, scene ideas, scripts, and design concepts.
- Coding and builder support including code generation, code explanation, debugging, React, Next.js, frontend layouts, backend planning, APIs, UI components, technical task lists, and product workflows.
- Workspace and project support including organizing conversations, files, generated content, code, creative assets, plans, outputs, build sessions, research, drafts, saved work, and project history.

How I work:

- If no project is selected, I operate in general assistant mode like a full AI chat assistant.
- If you open a project or workspace, I keep that work organized so you can continue from conversation into useful output.
- I should not force the user into a niche use case or single audience path.
- The inline build panel stays closed by default and opens only when the user chooses a project, workspace, generation, or build flow.

Streams AI is not just a chatbot. It is an AI assistant workspace that helps users turn conversations into completed work.`;

function encodeSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function readLibraryFiles() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(LIBRARY_KEY) || "[]");
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
  window.sessionStorage.setItem(LIBRARY_KEY, JSON.stringify(unique));
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

function wantsReadableFileContext(message = "", body = {}) {
  if (Array.isArray(body.attachments) && body.attachments.length) return true;
  return /\b(uploaded|attached|attachment|file|document|pdf|image|photo|video|transcript|read this|analyze this|summarize this)\b/i.test(String(message || ""));
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
    if (input.getAttribute("aria-label") === "Add photos and files") return;
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

async function getCapabilitiesText() {
  return PUBLIC_STREAMS_CAPABILITY_TEXT;
}

function makeSseResponse(text, mode = "admin-browser", options = {}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const isToolResult = mode === "admin-browser";
  const stream = new ReadableStream({
    start(controller) {
      if (isToolResult) {
        controller.enqueue(encoder.encode(encodeSseEvent("activity", { phase: "tool.received", mode: "tool", statusText: "Received app response", startedAt, backendProof: { toolResultReceived: true, mode } })));
      } else {
        controller.enqueue(encoder.encode(encodeSseEvent("activity", { phase: "openai.started", mode: "chat", statusText: "Writing…", startedAt })));
      }
      controller.enqueue(encoder.encode(encodeSseEvent("response", { token: text })));
      controller.enqueue(encoder.encode(encodeSseEvent("complete", { elapsedMs: Date.now() - startedAt, mode, messageLength: text.length, ...(options || {}) })));
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
  const direct = body?.message || body?.input || body?.prompt || body?.text || body?.content || "";
  if (!wantsReadableFileContext(direct, body)) return body;
  const fileContext = recentReadableFileContext();
  if (!fileContext) return body;
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
    const headers = new Headers(init?.headers || {});
    const options = { ...init, headers };

    if (url.startsWith("/api/streams-ai")) {
      options.credentials = "same-origin";
    }

    if (method === "POST" && url === "/api/streams-ai/tools") {
      const body = parseChatBody(init);
      const nextBody = attachLatestImageToVideoBody(body);
      options.headers.set("Content-Type", "application/json");
      options.body = stringifyChatBody(nextBody);
      return originalFetch(input, options);
    }
    if (method === "POST" && url === "/api/streams-ai/messages") {
      const body = parseChatBody(init);
      const message = String(body?.message || body?.input || body?.prompt || body?.text || body?.content || "").trim();
      if (isStudioToolListIntent(message)) {
        try { return makeSseResponse(await getCapabilitiesText(), "studio-tools", { capabilityResponse: true }); } catch (error) { return makeSseResponse(`Capability overview failed: ${error?.message || "Unknown error"}`, "studio-tools"); }
      }
      if (isAdminBrowserToolIntent(message)) {
        try { const result = await runAdminBrowserTool(message); return makeSseResponse(result.responseText || `${result.tool} completed.`, "admin-browser", { tool: result.tool || "admin-browser" }); } catch (error) { return makeSseResponse(`Admin browser tool failed: ${error?.message || "Unknown error"}`, "admin-browser", { toolError: true }); }
      }
      const nextBody = appendFileContextToMessage(body);
      options.headers.set("Content-Type", "application/json");
      options.body = stringifyChatBody(nextBody);
      return originalFetch(input, options);
    }
    return originalFetch(input, options);
  };
  return () => { window.fetch = originalFetch; window.__streamsAdminBrowserToolFetchBridgeInstalled = false; };
}

export default function StreamsClientShell() {
  const { session, loading } = useAuth();
  const [mounted, setMounted] = useState(true);
  const chatRuntime = useStreamsChatRuntime();

  useEffect(() => {
    if (!loading || session) {
      setMounted(true);
    }
  }, [session, loading]);

  useEffect(() => installAdminBrowserToolFetchBridge(), []);
  useEffect(() => installComposerUploadBridge(), []);

  if (!mounted) return <main aria-label="Streams loading" style={{ minHeight: "100svh", background: "#080b18" }} />;
  return <><StreamsOperatorShell chatRuntime={chatRuntime} /><StreamsAIComposerParityBridge chatRuntime={chatRuntime} /><StreamsAIInlineActivityBridge chatRuntime={chatRuntime} /><ActualRecentChatsOverlay chatRuntime={chatRuntime} /><ThreadAssetsHydrator chatRuntime={chatRuntime} /><StreamingRecoveryBanner chatRuntime={chatRuntime} /><MemoryControlsPanel /></>;
}
