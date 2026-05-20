"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateStreamsImage, isImageIntent } from "../../runtime/streamsImageClient";
import { generateStreamsVideo, isVideoIntent } from "../../runtime/streamsVideoClient";
import { ingestStreamsLink, isLinkIntent, extractFirstUrl } from "../../runtime/streamsLinkClient";
import { createActivity } from "../../runtime/streamsActivityManager";
import { normalizeStreamsError, formatErrorForChat } from "../../runtime/streamsErrorManager";
import { detectPreCallRoute } from "../../runtime/streamsPreCallRouter";
import {
  addMediaItem,
  buildSessionTitle,
  createChatSession,
  deleteChatSession,
  ensureCurrentChatSession,
  getChatSession,
  listChatSessions,
  setCurrentSessionId,
  upsertChatSession,
} from "../../runtime/streamsLocalStore";
import {
  addGeneratedImage,
  addGeneratedVideo,
  buildShareChatPayload,
  listGeneratedImages,
  listGeneratedVideos,
  listLibraryFiles,
  upsertLibraryFile,
  updateGeneratedImage,
} from "../../runtime/streamsAssetStore";

const CHAT_STATUS_FALLBACK = "Understanding…";
const CHAT_STREAM_FLUSH_MS = 38;
const CHAT_STREAM_CHUNK_SIZE = 18;

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultActivity() {
  return { phase: "idle", mode: "chat", statusText: "Ready" };
}

function buildChatStatusMessage(statusText = CHAT_STATUS_FALLBACK) {
  const clean = String(statusText || CHAT_STATUS_FALLBACK).replace(/\s+/g, " ").trim();
  return `✦ ${clean || CHAT_STATUS_FALLBACK}`;
}

function scrollActiveChatToBottom() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const activeSurface = document.querySelector(".startChatSurface");
    if (activeSurface) {
      activeSurface.scrollTo({ top: activeSurface.scrollHeight, behavior: "smooth" });
      return;
    }
    const splitSurface = document.querySelector(".splitChatScroll");
    if (splitSurface) splitSurface.scrollTo({ top: splitSurface.scrollHeight, behavior: "smooth" });
  });
}

function buildRequestedSizeLabel(aspectRatio = "1:1") {
  switch (aspectRatio) {
    case "16:9": return "1536 × 864";
    case "9:16": return "864 × 1536";
    case "4:5": return "1024 × 1280";
    default: return "1024 × 1024";
  }
}

function normalizeUploadAsset(asset = {}) {
  const url = asset.storageUrl || asset.previewUrl || asset.publicUrl || asset.url || "";
  const mimeType = asset.mimeType || "application/octet-stream";
  const kind = asset.kind || (mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "file");
  return {
    ...asset,
    id: asset.id || createId("asset"),
    kind,
    source: asset.source || "uploaded",
    name: asset.name || asset.title || "Uploaded file",
    mimeType,
    storageUrl: asset.storageUrl || url,
    previewUrl: asset.previewUrl || url,
    publicUrl: asset.publicUrl || url,
    url,
    status: asset.status || "ready",
    createdAt: asset.createdAt || new Date().toISOString(),
  };
}

function uploadStatusLine(asset) {
  const kind = asset.kind || "file";
  if (kind === "image") return asset.imageAnalysisText || asset.textPreview ? "Vision/text analysis ready." : "Reference image selected.";
  if (kind === "video") return `Frames: ${asset.videoFrameCount || 0} sampled · Transcript: ${asset.transcriptionText || asset.textPreview ? "ready" : asset.extractionStatus || "pending"}.`;
  if (kind === "audio") return asset.transcriptionText || asset.textPreview ? "Transcript ready." : "Audio saved; transcription pending or unavailable.";
  if (kind === "pdf" || kind === "document") return `Extracted text chunks: ${asset.textChunkCount || 0}.`;
  if (kind === "text" || /text|json|javascript|typescript|css|html|csv|xml/i.test(asset.mimeType || "")) return `Text extracted and chunked: ${asset.textChunkCount || 0} chunks.`;
  return asset.extractionStatus === "unsupported" ? "Saved. This file type is not fully analyzable yet." : "Saved for chat context.";
}

function buildUploadAssistantMessage(assets = []) {
  const lines = [
    `Uploaded ${assets.length} file${assets.length === 1 ? "" : "s"} to chat library.`,
    "",
    ...assets.map((asset) => [
      `**${asset.name}**`,
      `Type: ${asset.kind || "file"} · ${asset.mimeType || "unknown"}`,
      uploadStatusLine(asset),
      asset.extractionError ? `Extractor note: ${asset.extractionError}` : "",
      asset.videoFrameAnalysisError ? `Video analyzer note: ${asset.videoFrameAnalysisError}` : "",
    ].filter(Boolean).join("\n")),
    "",
    "Ready for questions, analysis, summaries, debugging, transcription, or media routing.",
  ];
  return lines.join("\n\n");
}

function buildLinkAssistantMessage(asset, summary = "") {
  return [
    summary || `${asset.name || "Link"} added to chat library.`,
    "",
    `Platform: ${asset.platform || "web"}`,
    asset.videoId ? `Video ID: ${asset.videoId}` : "",
    asset.requiresCapture ? "This link may require user-approved browser/extension capture for logged-in or private content." : "",
    asset.nextSteps?.length ? `Next: ${asset.nextSteps[0]}` : "Ready for analysis.",
  ].filter(Boolean).join("\n");
}

function selectLatestUploadedImage() {
  return listLibraryFiles()
    .map(normalizeUploadAsset)
    .find((asset) => asset.url && (asset.kind === "image" || String(asset.mimeType || "").startsWith("image/"))) || null;
}

function wantsImageToVideo(message = "") {
  const text = String(message || "").toLowerCase();
  return /(this|uploaded|reference|image|photo|picture|portrait|it)[\s\S]{0,80}(video|move|moving|motion|animate|animation|cinematic)/.test(text) || /(turn|make|create|generate|animate)[\s\S]{0,80}(this|uploaded|reference|image|photo|picture|portrait|it)/.test(text) || /image\s*to\s*video/.test(text);
}

export function useStreamsChatRuntime() {
  const abortRef = useRef(null);
  const sentinelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [activity, setActivity] = useState(defaultActivity());
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [sessions, setSessions] = useState([]);
  const [imageGallery, setImageGallery] = useState([]);
  const [videoGallery, setVideoGallery] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [viewerImage, setViewerImage] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const container = document.querySelector(".splitChatScroll");
    if (!container) return;
    const sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    sentinel.style.height = "1px";
    container.appendChild(sentinel);
    sentinelRef.current = sentinel;
    const observer = new IntersectionObserver(([entry]) => setIsAtBottom(entry.isIntersecting), { root: container, threshold: 0.95 });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (sentinelRef.current?.parentNode) sentinelRef.current.parentNode.removeChild(sentinelRef.current);
    };
  }, []);

  const refreshSidebarData = useCallback(() => {
    setSessions(listChatSessions());
    setImageGallery(listGeneratedImages());
    setVideoGallery(listGeneratedVideos());
    setLibraryFiles(listLibraryFiles());
  }, []);

  useEffect(() => {
    const session = ensureCurrentChatSession();
    setSessionId(session.id);
    setMessages(Array.isArray(session.messages) ? session.messages : []);
    refreshSidebarData();
  }, [refreshSidebarData]);

  useEffect(() => {
    if (!sessionId) return;
    upsertChatSession({ id: sessionId, title: buildSessionTitle(messages), messages });
    refreshSidebarData();
  }, [sessionId, messages, refreshSidebarData]);

  useEffect(() => {
    if (!isAtBottom || !sentinelRef.current) return;
    const raf = requestAnimationFrame(() => sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    return () => cancelAnimationFrame(raf);
  }, [messages, isAtBottom]);

  const newChat = useCallback(() => {
    abortRef.current?.abort?.();
    const session = createChatSession();
    setCurrentSessionId(session.id);
    setSessionId(session.id);
    setMessages([]);
    setActiveArtifact(null);
    setActivity(defaultActivity());
    setIsStreaming(false);
    refreshSidebarData();
    return session.id;
  }, [refreshSidebarData]);

  const openImageViewer = useCallback((image) => { setViewerImage(image); setViewerOpen(true); }, []);
  const closeImageViewer = useCallback(() => { setViewerOpen(false); setViewerImage(null); }, []);

  const forceTerminalChatFallback = useCallback((content = "Chat backend is not configured for a live assistant response in this frontend build.") => {
    setMessages((current) => {
      let lastUserIndex = -1;
      for (let index = current.length - 1; index >= 0; index -= 1) if (current[index]?.role === "user") { lastUserIndex = index; break; }
      if (lastUserIndex === -1) return current;
      const hasAssistantAfterLastUser = current.slice(lastUserIndex + 1).some((message) => message?.role === "assistant" && String(message?.content || "").trim() && !message?.isStatusOnly);
      if (hasAssistantAfterLastUser) return current;
      return [...current, { id: createId("assistant"), role: "assistant", content, status: "error", chunks: [content], toolCalls: [], artifacts: [], createdAt: new Date().toISOString() }];
    });
    setActivity(defaultActivity());
    setIsStreaming(false);
  }, []);

  const appendAssistantFallback = useCallback((assistantId, content) => {
    setMessages((current) => {
      const target = current.find((item) => item.id === assistantId);
      if (!target || (String(target.content || "").trim() && !target.isStatusOnly)) return current;
      return current.map((item) => item.id === assistantId ? { ...item, content, isStreaming: false, isStatusOnly: false, status: "error" } : item);
    });
    scrollActiveChatToBottom();
  }, []);

  const updateMessageImage = useCallback((assistantId, patch) => {
    setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, generatedImage: { ...(item.generatedImage || {}), ...patch } } : item));
  }, []);

  const handleImageLoaded = useCallback((assistantId, patch) => {
    updateMessageImage(assistantId, patch);
    const currentMessage = messages.find((item) => item.id === assistantId);
    if (currentMessage?.generatedImage?.id) updateGeneratedImage(currentMessage.generatedImage.id, patch);
  }, [messages, updateMessageImage]);

  const copyAsset = useCallback(async (asset) => {
    if (!asset?.url) return;
    const response = await fetch(asset.url);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
  }, []);

  const saveAsset = useCallback(async (asset) => {
    if (!asset?.url) return;
    const anchor = document.createElement("a");
    anchor.href = asset.url;
    anchor.download = asset.name || asset.fileName || "asset";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, []);

  const shareAsset = useCallback(async (asset) => {
    if (!asset?.url) return;
    if (navigator.share) return navigator.share({ title: asset.name || "Generated asset", url: asset.url });
    await navigator.clipboard.writeText(asset.url);
  }, []);

  const shareCurrentChat = useCallback(async () => {
    const session = getChatSession(sessionId);
    const payload = buildShareChatPayload(session);
    if (navigator.share) return navigator.share(payload);
    await navigator.clipboard.writeText(payload.text || payload.title);
  }, [sessionId]);

  const uploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return [];
    setActivity(createActivity("thinking", "file", "Uploading and analyzing files…"));
    const form = new FormData();
    files.forEach((file) => form.append("file", file));
    try {
      const response = await fetch("/api/streams-ai/assets", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || data?.success === false) throw new Error(data?.error || "Upload failed");
      const assets = (Array.isArray(data.assets) ? data.assets : Array.isArray(data.files) ? data.files : []).map(normalizeUploadAsset);
      assets.forEach((asset) => upsertLibraryFile(asset));
      setLibraryFiles(listLibraryFiles());
      setMessages((current) => [...current, { id: createId("assistant"), role: "assistant", content: buildUploadAssistantMessage(assets), uploadedAssets: assets, createdAt: new Date().toISOString() }]);
      setActivity(createActivity("complete", "file", "Files ready"));
      refreshSidebarData();
      return assets;
    } catch (error) {
      const normalized = normalizeStreamsError(error);
      setMessages((current) => [...current, { id: createId("assistant"), role: "assistant", content: formatErrorForChat(normalized), status: "error" }]);
      setActivity(createActivity("error", "file", "Upload failed"));
      return [];
    }
  }, [refreshSidebarData]);

  const saveEditedImage = useCallback((image) => {
    if (!image?.id) return;
    updateGeneratedImage(image.id, { editState: image.editState });
    refreshSidebarData();
  }, [refreshSidebarData]);

  const sendMessage = useCallback(async ({ message, composerMode = "chat" }) => {
    if (!mounted) return;
    const trimmed = String(message || "").trim();
    if (!trimmed) return;

    abortRef.current?.abort?.();
    abortRef.current = new AbortController();
    const userId = createId("user");
    const assistantId = createId("assistant");
    const route = detectPreCallRoute(trimmed);

    setMessages((current) => [...current, { id: userId, role: "user", content: trimmed }]);
    scrollActiveChatToBottom();

    if (isLinkIntent(trimmed, composerMode)) {
      setActivity(createActivity("thinking", "link", "Reading link…"));
      try {
        const linkResult = await ingestStreamsLink({ url: extractFirstUrl(trimmed), message: trimmed, intent: "analyze", signal: abortRef.current.signal });
        const asset = normalizeUploadAsset(linkResult.asset || {});
        upsertLibraryFile(asset);
        setLibraryFiles(listLibraryFiles());
        setMessages((current) => [...current, { id: assistantId, role: "assistant", content: buildLinkAssistantMessage(asset, linkResult.summary), linkAsset: asset, createdAt: new Date().toISOString() }]);
        setActivity(createActivity("complete", "link", "Link ready"));
        refreshSidebarData();
        return;
      } catch (error) {
        const normalized = normalizeStreamsError(error);
        setMessages((current) => [...current, { id: assistantId, role: "assistant", content: formatErrorForChat(normalized), status: "error" }]);
        setActivity(createActivity("error", "link", "Link failed"));
        return;
      }
    }

    if (route.mode === "image" || isImageIntent(trimmed)) {
      const imageId = createId("image");
      const requestAspectRatio = "1:1";
      const requestSizeLabel = buildRequestedSizeLabel(requestAspectRatio);
      setActivity(createActivity("rendering", "image", "Generating image…"));
      setIsStreaming(true);
      setMessages((current) => [...current, { id: assistantId, role: "assistant", content: "", isStreaming: true, generatedImage: { id: imageId, status: "streaming", statusText: "Generating image…", requestSizeLabel, aspectRatio: requestAspectRatio, partialUrl: "", url: "" } }]);
      try {
        const result = await generateStreamsImage({ prompt: trimmed, signal: abortRef.current.signal, onStatus: (statusText) => { updateMessageImage(assistantId, { status: "streaming", statusText: statusText || "Generating image…" }); setActivity(createActivity("rendering", "image", statusText || "Generating image…")); }, onPartial: (partial) => updateMessageImage(assistantId, { status: "streaming", partialUrl: partial?.url || "", statusText: partial?.statusText || "Generating image…" }) });
        const imageRecord = { id: imageId, kind: "image", source: "generated", name: "Generated image", mimeType: result?.mimeType || "image/png", url: result?.artifactUrl || result?.outputUrl, storageUrl: result?.artifactUrl || result?.outputUrl, previewUrl: result?.artifactUrl || result?.outputUrl, width: result?.width || null, height: result?.height || null, requestSizeLabel, createdAt: new Date().toISOString() };
        addGeneratedImage(imageRecord);
        upsertLibraryFile({ id: imageId, kind: "image", source: "generated", name: "Generated image", mimeType: imageRecord.mimeType, sizeBytes: 0, storageUrl: imageRecord.url, previewUrl: imageRecord.url, createdAt: imageRecord.createdAt });
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, generatedImage: { ...item.generatedImage, ...imageRecord, status: "ready", statusText: imageRecord.width && imageRecord.height ? `${imageRecord.width} × ${imageRecord.height}` : requestSizeLabel, url: imageRecord.url, partialUrl: imageRecord.url } } : item));
        setActivity(createActivity("complete", "image", "Image ready"));
        setIsStreaming(false);
        refreshSidebarData();
        return;
      } catch (error) {
        const normalized = normalizeStreamsError(error);
        setMessages((current) => [...current, { id: createId("assistant"), role: "assistant", content: formatErrorForChat(normalized) }]);
        setActivity(createActivity("error", "image", "Image failed"));
        setIsStreaming(false);
        return;
      }
    }

    if (route.mode === "video" || isVideoIntent(trimmed)) {
      setActivity(createActivity("rendering", "video", "Rendering video…"));
      setIsStreaming(true);
      setMessages((current) => [...current, { id: assistantId, role: "assistant", content: "Rendering video…", isStreaming: true }]);
      try {
        const referenceImage = wantsImageToVideo(trimmed) ? selectLatestUploadedImage() : null;
        const videoResult = await generateStreamsVideo({ prompt: trimmed, imageUrl: referenceImage?.url || undefined, mode: referenceImage?.url ? "i2v" : "t2v", aspectRatio: referenceImage?.url ? "9:16" : "16:9", signal: abortRef.current.signal, onStatus: (statusText) => { const nextStatusText = statusText || "Rendering video…"; setActivity(createActivity("rendering", "video", nextStatusText)); setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: nextStatusText, isStreaming: true } : item)); } });
        const videoId = createId("video");
        const videoRecord = { id: videoId, kind: "video", source: "generated", name: referenceImage?.url ? "Generated image-to-video" : "Generated video", mimeType: videoResult.mimeType || "video/mp4", url: videoResult.artifactUrl, storageUrl: videoResult.artifactUrl, previewUrl: videoResult.artifactUrl, generationId: videoResult.generationId, prompt: trimmed, sourceImageId: referenceImage?.id || "", createdAt: new Date().toISOString() };
        addGeneratedVideo(videoRecord);
        upsertLibraryFile({ id: videoId, kind: "video", source: "generated", name: videoRecord.name, mimeType: videoRecord.mimeType, sizeBytes: 0, storageUrl: videoRecord.url, previewUrl: videoRecord.url, createdAt: videoRecord.createdAt });
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: "", isStreaming: false, generatedVideoUrl: videoResult.artifactUrl, generatedVideo: videoRecord, generationId: videoResult.generationId, mimeType: videoResult.mimeType } : item));
        setActivity(createActivity("complete", "video", "Video ready"));
        setIsStreaming(false);
        refreshSidebarData();
        return;
      } catch (error) {
        const normalized = normalizeStreamsError(error);
        const errorText = formatErrorForChat(normalized);
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: errorText, isStreaming: false } : item));
        setActivity(createActivity("error", "video", "Video failed"));
        setIsStreaming(false);
        return;
      }
    }

    setMessages((current) => [...current, { id: assistantId, role: "assistant", content: buildChatStatusMessage(CHAT_STATUS_FALLBACK), isStreaming: true, isStatusOnly: true, status: "thinking", chunks: [], toolCalls: [], artifacts: [], createdAt: new Date().toISOString() }]);
    setActivity(createActivity("thinking", "chat", CHAT_STATUS_FALLBACK));
    setIsStreaming(true);
    scrollActiveChatToBottom();

    let assistantOutputStarted = false;
    let queuedTokens = "";
    let flushTimer = 0;

    const clearFlushTimer = () => {
      if (flushTimer) window.clearTimeout(flushTimer);
      flushTimer = 0;
    };

    const flushQueuedTokens = (force = false) => {
      clearFlushTimer();
      if (!queuedTokens) return;
      const next = force ? queuedTokens : queuedTokens.slice(0, Math.min(CHAT_STREAM_CHUNK_SIZE, queuedTokens.length));
      queuedTokens = queuedTokens.slice(next.length);
      setMessages((current) => current.map((item) => {
        if (item.id !== assistantId) return item;
        const existing = item.isStatusOnly ? "" : String(item.content || "");
        return { ...item, content: `${existing}${next}`, chunks: [...(item.chunks || []), next], isStreaming: true, isStatusOnly: false, status: "streaming" };
      }));
      scrollActiveChatToBottom();
      if (queuedTokens) flushTimer = window.setTimeout(() => flushQueuedTokens(false), CHAT_STREAM_FLUSH_MS);
    };

    const queueAssistantToken = (token) => {
      const text = String(token || "");
      if (!text) return;
      queuedTokens += text;
      if (!flushTimer) flushTimer = window.setTimeout(() => flushQueuedTokens(false), CHAT_STREAM_FLUSH_MS);
    };

    const updateAssistantStatus = (statusText) => {
      const nextStatus = statusText || CHAT_STATUS_FALLBACK;
      setActivity(createActivity("thinking", "chat", nextStatus));
      if (assistantOutputStarted) return;
      setMessages((current) => current.map((item) => item.id === assistantId && item.isStatusOnly ? { ...item, content: buildChatStatusMessage(nextStatus), status: "thinking", isStreaming: true } : item));
      scrollActiveChatToBottom();
    };

    const fallbackTimer = window.setTimeout(() => {
      if (!assistantOutputStarted) {
        clearFlushTimer();
        appendAssistantFallback(assistantId, "The live assistant is taking longer than expected. The message is saved; retry if this does not continue shortly.");
        setActivity(createActivity("complete", "chat", "Ready"));
        setIsStreaming(false);
      }
    }, 16000);

    try {
      const response = await fetch("/api/streams-ai/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: trimmed, userId }), signal: abortRef.current.signal });
      if (!response.ok) throw new Error(`Chat API error: ${response.statusText}`);
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const parseSSEChunk = (chunkBuffer) => {
        const events = [];
        const parts = chunkBuffer.split("\n\n");
        const rest = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          let eventName = "message";
          const dataLines = [];
          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
          }
          const dataRaw = dataLines.join("\n");
          if (!dataRaw) continue;
          try { events.push({ eventName, payload: JSON.parse(dataRaw) }); } catch { events.push({ eventName, payload: { message: dataRaw } }); }
        }
        return { events, rest };
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSSEChunk(buffer);
        buffer = parsed.rest;
        for (const { eventName, payload } of parsed.events) {
          if (eventName === "activity") updateAssistantStatus(payload?.statusText || payload?.text || "Thinking…");
          if (eventName === "response") {
            const token = payload?.token || payload?.delta || payload?.text;
            if (token) {
              assistantOutputStarted = true;
              window.clearTimeout(fallbackTimer);
              queueAssistantToken(token);
            }
          }
          if (eventName === "artifact") setActiveArtifact(payload);
          if (eventName === "complete") {
            window.clearTimeout(fallbackTimer);
            flushQueuedTokens(true);
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, isStatusOnly: false, status: "complete" } : item));
            setActivity(createActivity("complete", "chat", "Ready"));
            setIsStreaming(false);
            scrollActiveChatToBottom();
          }
          if (eventName === "error") throw new Error(payload?.message || payload?.error || "Chat failed");
        }
      }
      window.clearTimeout(fallbackTimer);
      flushQueuedTokens(true);
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, isStatusOnly: false, status: "complete" } : item));
      setActivity(createActivity("complete", "chat", "Ready"));
      setIsStreaming(false);
    } catch (error) {
      window.clearTimeout(fallbackTimer);
      clearFlushTimer();
      const normalized = normalizeStreamsError(error);
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, isStatusOnly: false, content: formatErrorForChat(normalized), status: "error" } : item));
      setActivity(createActivity("error", "chat", "Error"));
      setIsStreaming(false);
      scrollActiveChatToBottom();
    }
  }, [mounted, refreshSidebarData, updateMessageImage, appendAssistantFallback]);

  const api = useMemo(() => ({
    messages,
    activeArtifact,
    activity,
    isStreaming,
    statusLabel: activity?.statusText || "Ready",
    sendMessage,
    newChat,
    sessionId,
    sessions,
    imageGallery,
    videoGallery,
    libraryFiles,
    shareCurrentChat,
    openImageViewer,
    closeImageViewer,
    viewerImage,
    viewerOpen,
    saveEditedImage,
    handleImageLoaded,
    copyAsset,
    saveAsset,
    shareAsset,
    uploadFiles,
    forceTerminalChatFallback,
    selectSession: (id) => {
      const session = getChatSession(id);
      if (!session) return;
      setCurrentSessionId(id);
      setSessionId(id);
      setMessages(Array.isArray(session.messages) ? session.messages : []);
    },
    deleteSession: (id) => {
      deleteChatSession(id);
      refreshSidebarData();
      if (sessionId === id) newChat();
    },
    addMediaItem,
  }), [messages, activeArtifact, activity, isStreaming, sendMessage, newChat, sessionId, sessions, imageGallery, videoGallery, libraryFiles, shareCurrentChat, openImageViewer, closeImageViewer, viewerImage, viewerOpen, saveEditedImage, handleImageLoaded, copyAsset, saveAsset, shareAsset, uploadFiles, forceTerminalChatFallback, refreshSidebarData, sessionId]);

  return api;
}
