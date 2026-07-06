"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { generateStreamsImage, isImageIntent } from "../../runtime/streamsImageClient";
import { generateStreamsVideo, isVideoIntent } from "../../runtime/streamsVideoClient";
import { ingestStreamsLink, isLinkIntent, extractFirstUrl } from "../../runtime/streamsLinkClient";
import { createActivity } from "../../runtime/streamsActivityManager";
import { normalizeStreamsError, formatErrorForChat } from "../../runtime/streamsErrorManager";
import { detectPreCallRoute } from "../../runtime/streamsPreCallRouter";
import {
  addMediaItem,
  buildSessionTitle,
  deleteChatSession,
  getChatSession,
  listChatSessions,
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
  deleteLibraryFile,
} from "../../runtime/streamsAssetStore";

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultActivity() {
  return { phase: "idle", mode: "chat", statusText: "Ready" };
}

function scrollActiveChatToBottom() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const activeSurface = document.querySelector(".startChatSurface");
    if (activeSurface) {
      activeSurface.scrollTo({ top: activeSurface.scrollHeight, behavior: "smooth" });
      return;
    }
    const chatScroll = document.querySelector(".chatScroll");
    if (chatScroll) {
      chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: "smooth" });
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
  const mimeType = asset.mimeType || asset.mime_type || "application/octet-stream";
  const kind = asset.kind || (mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "file");
  const id = asset.id || createId("asset");
  const url = asset.url || asset.publicUrl || asset.public_url || asset.storageUrl || asset.previewUrl || `/api/streams-ai/assets/download?assetId=${id}`;
  return {
    ...asset,
    id,
    kind,
    source: asset.source || "uploaded",
    name: asset.name || asset.title || "Uploaded file",
    mimeType,
    storageBucket: asset.storageBucket || asset.storage_bucket || null,
    storagePath: asset.storagePath || asset.storage_path || null,
    storageUrl: asset.storageUrl || asset.storage_path || url,
    previewUrl: asset.previewUrl || url,
    publicUrl: asset.publicUrl || asset.public_url || url,
    url,
    status: asset.status || "ready",
    createdAt: asset.createdAt || asset.created_at || new Date().toISOString(),
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

function mapStoredMessages(data) {
  return Array.isArray(data.messages) ? data.messages.map((m) => ({
    id: m.id || createId("msg"),
    role: m.role || "assistant",
    content: m.content || "",
    status: m.status || "complete",
    createdAt: m.created_at || m.createdAt || new Date().toISOString(),
    ...m.metadata,
  })) : [];
}

function parseSSEChunk(chunkBuffer) {
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
  const [composerAttachments, setComposerAttachments] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(() => {
    if (typeof window !== "undefined") {
      const segments = window.location.pathname.split("/").filter(Boolean);
      return segments[0] === "streams-ai" && !!segments[1];
    }
    return false;
  });
  const [viewerImage, setViewerImage] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("Thinking");
  const [selectedProvider, setSelectedProvider] = useState("Auto");

  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const refreshSidebarData = useCallback(() => {
    setSessions(listChatSessions());
    setImageGallery(listGeneratedImages());
    setVideoGallery(listGeneratedVideos());
    setLibraryFiles(listLibraryFiles());
  }, []);

  const loadSessionMessages = useCallback((id) => {
    if (!id) return;
    setSessionId(id);
    setMessages([]);
    setIsLoadingMessages(true);
    setActivity(createActivity("thinking", "chat", "Loading chat history…"));
    fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("History failed");
        return res.json();
      })
      .then((data) => {
        setMessages(mapStoredMessages(data));
        setActivity(defaultActivity());
        setIsLoadingMessages(false);
      })
      .catch(() => {
        setActivity(defaultActivity());
        setIsLoadingMessages(false);
      });
  }, []);

  useEffect(() => {
    let urlSessionId = "";
    if (typeof window !== "undefined") {
      const segments = window.location.pathname.split("/").filter(Boolean);
      if (segments[0] === "streams-ai" && segments[1]) urlSessionId = segments[1];
    }

    if (urlSessionId && urlSessionId !== sessionId) loadSessionMessages(urlSessionId);
    else if (!urlSessionId && sessionId) {
      setSessionId("");
      setMessages([]);
      setActivity(defaultActivity());
    }
  }, [pathname, sessionId, loadSessionMessages]);

  useEffect(() => {
    if (!sessionId) return;
    upsertChatSession({ id: sessionId, title: buildSessionTitle(messages), messages });
    refreshSidebarData();
  }, [sessionId, messages, refreshSidebarData]);

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

  useEffect(() => {
    if (!isAtBottom || !sentinelRef.current) return;
    const raf = requestAnimationFrame(() => sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    return () => cancelAnimationFrame(raf);
  }, [messages, isAtBottom]);

  const newChat = useCallback(() => {
    abortRef.current?.abort?.();
    window.history.pushState(null, "", "/streams-ai");
    setSessionId("");
    setMessages([]);
    setActiveArtifact(null);
    setActivity(defaultActivity());
    setIsStreaming(false);
    refreshSidebarData();
    return "";
  }, [refreshSidebarData]);

  const openImageViewer = useCallback((image) => { setViewerImage(image); setViewerOpen(true); }, []);
  const closeImageViewer = useCallback(() => { setViewerOpen(false); setViewerImage(null); }, []);

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
    let downloadHref = asset.url;
    if (typeof downloadHref === "string" && downloadHref.includes("/api/streams-ai/assets/download") && !downloadHref.includes("download=1")) {
      downloadHref += (downloadHref.includes("?") ? "&" : "?") + "download=1";
    }
    const anchor = document.createElement("a");
    anchor.href = downloadHref;
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
    const localPreviews = files.map((file) => {
      const localUrl = URL.createObjectURL(file);
      const mimeType = file.type || "application/octet-stream";
      const kind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "file";
      return { id: createId("local"), name: file.name, mimeType, kind, url: localUrl, storageUrl: localUrl, previewUrl: localUrl, publicUrl: "", sizeBytes: file.size, status: "uploading", _localUrl: localUrl };
    });

    setComposerAttachments((current) => [...current, ...localPreviews]);
    setActivity(createActivity("thinking", "file", "Uploading…"));

    const form = new FormData();
    files.forEach((file) => form.append("file", file));

    try {
      const response = await fetch("/api/streams-ai/assets", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || data?.success === false) throw new Error(data?.error || "Upload failed");

      const serverAssets = (Array.isArray(data.assets) ? data.assets : Array.isArray(data.files) ? data.files : []).map(normalizeUploadAsset);
      setComposerAttachments((current) => {
        const localIds = new Set(localPreviews.map((p) => p.id));
        const withoutLocals = current.filter((f) => !localIds.has(f.id));
        localPreviews.forEach((p) => { try { URL.revokeObjectURL(p._localUrl); } catch {} });
        return [...withoutLocals, ...serverAssets];
      });
      serverAssets.forEach((asset) => upsertLibraryFile(asset));
      setLibraryFiles(listLibraryFiles());
      setActivity(createActivity("complete", "file", "Files ready"));
      refreshSidebarData();
      return serverAssets;
    } catch {
      setComposerAttachments((current) => current.map((f) => localPreviews.some((p) => p.id === f.id) ? { ...f, status: "error" } : f));
      setActivity(createActivity("error", "file", "Upload failed"));
      return [];
    }
  }, [refreshSidebarData]);

  const saveEditedImage = useCallback((image) => {
    if (!image?.id) return;
    updateGeneratedImage(image.id, { editState: image.editState });
    refreshSidebarData();
  }, [refreshSidebarData]);

  const removeComposerAttachment = useCallback((fileId) => {
    if (!fileId) return;
    setComposerAttachments((current) => current.filter((file) => file.id !== fileId));
  }, []);

  const forceTerminalChatFallback = useCallback((content = "Chat backend is not configured for a live assistant response in this frontend build.") => {
    setMessages((current) => {
      let lastUserIndex = -1;
      for (let index = current.length - 1; index >= 0; index -= 1) if (current[index]?.role === "user") { lastUserIndex = index; break; }
      if (lastUserIndex === -1) return current;
      const hasAssistantAfterLastUser = current.slice(lastUserIndex + 1).some((message) => message?.role === "assistant" && String(message?.content || "").trim());
      if (hasAssistantAfterLastUser) return current;
      return [...current, { id: createId("assistant"), role: "assistant", content, status: "error", chunks: [content], toolCalls: [], artifacts: [], createdAt: new Date().toISOString() }];
    });
    setActivity(defaultActivity());
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async ({ message, composerMode = "chat", mode = selectedMode, provider = selectedProvider, webSearchEnabled = false }) => {
    if (!mounted) return;
    const trimmed = String(message || "").trim();
    if (!trimmed) return;

    abortRef.current?.abort?.();
    abortRef.current = new AbortController();

    const userId = createId("user");
    const assistantId = createId("assistant");
    const route = detectPreCallRoute(trimmed);
    const userAttachments = composerAttachments.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType || file.mime_type,
      kind: file.kind,
      url: file.url || file.storageUrl || file.publicUrl || file.public_url || `/api/streams-ai/assets/download?assetId=${file.id}`,
      storageBucket: file.storageBucket || file.storage_bucket,
      storagePath: file.storagePath || file.storage_path,
      sizeBytes: file.sizeBytes,
      textPreview: file.textPreview || "",
    }));

    const activeSessionId = sessionId || "";
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmed, attachments: userAttachments, createdAt: new Date().toISOString() },
      { id: assistantId, role: "assistant", content: "", isStreaming: true, status: "streaming", chunks: [], toolCalls: [], artifacts: [], createdAt: new Date().toISOString() },
    ]);
    setComposerAttachments([]);
    setIsStreaming(true);
    setActivity(createActivity("thinking", "chat", "Writing…"));
    scrollActiveChatToBottom();

    if (isLinkIntent(trimmed, composerMode)) {
      setActivity(createActivity("thinking", "link", "Reading link…"));
      try {
        const linkResult = await ingestStreamsLink({ url: extractFirstUrl(trimmed), message: trimmed, intent: "analyze", signal: abortRef.current.signal });
        const asset = normalizeUploadAsset(linkResult.asset || {});
        upsertLibraryFile(asset);
        setLibraryFiles(listLibraryFiles());
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: buildLinkAssistantMessage(asset, linkResult.summary), linkAsset: asset, isStreaming: false, status: "complete" } : item));
        setActivity(createActivity("complete", "link", "Link ready"));
        setIsStreaming(false);
        refreshSidebarData();
      } catch (error) {
        const normalized = normalizeStreamsError(error);
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: formatErrorForChat(normalized), isStreaming: false, status: "error" } : item));
        setActivity(createActivity("error", "link", "Link failed"));
        setIsStreaming(false);
      }
      return;
    }

    if (route.mode === "image" || isImageIntent(trimmed)) {
      const imageId = createId("image");
      const requestAspectRatio = "1:1";
      const requestSizeLabel = buildRequestedSizeLabel(requestAspectRatio);
      setActivity(createActivity("rendering", "image", "Generating image…"));
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, generatedImage: { id: imageId, status: "streaming", statusText: "Generating image…", requestSizeLabel, aspectRatio: requestAspectRatio, partialUrl: "", url: "" } } : item));
      try {
        const result = await generateStreamsImage({ prompt: trimmed, signal: abortRef.current.signal, onStatus: (statusText) => { updateMessageImage(assistantId, { status: "streaming", statusText: statusText || "Generating image…" }); setActivity(createActivity("rendering", "image", statusText || "Generating image…")); }, onPartial: (partial) => updateMessageImage(assistantId, { status: "streaming", partialUrl: partial?.url || "", statusText: partial?.statusText || "Generating image…" }) });
        const imageRecord = { id: imageId, kind: "image", source: "generated", name: "Generated image", mimeType: result?.mimeType || "image/png", url: result?.artifactUrl || result?.outputUrl, storageUrl: result?.artifactUrl || result?.outputUrl, previewUrl: result?.artifactUrl || result?.outputUrl, width: result?.width || null, height: result?.height || null, requestSizeLabel, sessionId: activeSessionId, createdAt: new Date().toISOString() };
        addGeneratedImage(imageRecord);
        upsertLibraryFile({ id: imageId, kind: "image", source: "generated", name: "Generated image", mimeType: imageRecord.mimeType, sizeBytes: 0, storageUrl: imageRecord.url, previewUrl: imageRecord.url, createdAt: imageRecord.createdAt });
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, generatedImage: { ...item.generatedImage, ...imageRecord, status: "ready", statusText: imageRecord.width && imageRecord.height ? `${imageRecord.width} × ${imageRecord.height}` : requestSizeLabel, url: imageRecord.url, partialUrl: imageRecord.url }, status: "complete" } : item));
        setActivity(createActivity("complete", "image", "Image ready"));
        setIsStreaming(false);
        refreshSidebarData();
      } catch (error) {
        const normalized = normalizeStreamsError(error);
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: formatErrorForChat(normalized), isStreaming: false, status: "error" } : item));
        setActivity(createActivity("error", "image", "Image failed"));
        setIsStreaming(false);
      }
      return;
    }

    const isExplicitProvider = provider && provider !== "Auto";
    if (!isExplicitProvider && (route.mode === "video" || isVideoIntent(trimmed))) {
      setActivity(createActivity("rendering", "video", "Rendering video…"));
      try {
        const referenceImage = wantsImageToVideo(trimmed) ? selectLatestUploadedImage() : null;
        const videoResult = await generateStreamsVideo({ prompt: trimmed, imageUrl: referenceImage?.url || undefined, mode: referenceImage?.url ? "i2v" : "t2v", aspectRatio: referenceImage?.url ? "9:16" : "16:9", signal: abortRef.current.signal, onStatus: (statusText) => { const nextStatusText = statusText || "Rendering video…"; setActivity(createActivity("rendering", "video", nextStatusText)); setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: nextStatusText, isStreaming: true } : item)); } });
        const videoId = createId("video");
        const videoRecord = { id: videoId, kind: "video", source: "generated", name: referenceImage?.url ? "Generated image-to-video" : "Generated video", mimeType: videoResult.mimeType || "video/mp4", url: videoResult.artifactUrl, storageUrl: videoResult.artifactUrl, previewUrl: videoResult.artifactUrl, generationId: videoResult.generationId, prompt: trimmed, sessionId: activeSessionId, sourceImageId: referenceImage?.id || "", createdAt: new Date().toISOString() };
        addGeneratedVideo(videoRecord);
        upsertLibraryFile({ id: videoId, kind: "video", source: "generated", name: videoRecord.name, mimeType: videoRecord.mimeType, sizeBytes: 0, storageUrl: videoRecord.url, previewUrl: videoRecord.url, createdAt: videoRecord.createdAt });
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: "", isStreaming: false, generatedVideoUrl: videoResult.artifactUrl, generatedVideo: videoRecord, generationId: videoResult.generationId, mimeType: videoResult.mimeType, status: "complete" } : item));
        setActivity(createActivity("complete", "video", "Video ready"));
        setIsStreaming(false);
        refreshSidebarData();
      } catch (error) {
        const normalized = normalizeStreamsError(error);
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: formatErrorForChat(normalized), isStreaming: false, status: "error" } : item));
        setActivity(createActivity("error", "video", "Video failed"));
        setIsStreaming(false);
      }
      return;
    }

    const requestedWebSearch = webSearchEnabled || /^\s*(search the web|web search|search online|look up|find latest|latest)\b/i.test(trimmed);
    if (requestedWebSearch) {
      const query = trimmed.replace(/^\s*(search the web for|search the web|web search for|web search|search online for|search online|look up|find latest|latest)\s*/i, "").trim() || trimmed;
      setActivity(createActivity("thinking", "tool", "Searching the web…"));
      try {
        const searchResponse = await fetch("/api/streams-ai/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
        const searchData = await searchResponse.json();
        if (!searchResponse.ok || !searchData?.ok) throw new Error(searchData?.error || "Web search failed");
        const sourceLines = Array.isArray(searchData.annotations) && searchData.annotations.length ? "\n\nSources:\n" + searchData.annotations.map((annotation, index) => `${index + 1}. ${annotation.title || annotation.url || `Source ${index + 1}`}${annotation.url ? ` — ${annotation.url}` : ""}`).join("\n") : "";
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `${searchData.text || "No search answer returned."}${sourceLines}`, isStreaming: false, status: "complete", sources: searchData.annotations || [] } : item));
        setActivity(createActivity("complete", "tool", "Search complete"));
      } catch (error) {
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`, isStreaming: false, status: "error" } : item));
        setActivity(createActivity("error", "tool", "Search failed"));
      }
      setIsStreaming(false);
      return;
    }

    try {
      const requestPayload = { message: trimmed, userId, mode, provider, attachments: userAttachments };
      if (activeSessionId && !String(activeSessionId).startsWith("pending_chat_")) requestPayload.sessionId = activeSessionId;
      const response = await fetch("/api/streams-ai/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload), signal: abortRef.current.signal });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Chat API error: ${response.statusText}`);
      }
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSSEChunk(buffer);
        buffer = parsed.rest;
        for (const { eventName, payload } of parsed.events) {
          if (eventName === "activity") {
            const nextSessionId = payload?.sessionId;
            if (nextSessionId) {
              window.history.pushState(null, "", `/streams-ai/${nextSessionId}`);
              setSessionId(nextSessionId);
            }
            setActivity(createActivity("thinking", "chat", payload?.statusText || payload?.text || "Writing…"));
          }
          if (eventName === "response" || eventName === "reasoning") {
            const token = payload?.token || payload?.delta || payload?.text;
            if (token) {
              setMessages((current) => current.map((item) => {
                if (item.id !== assistantId) return item;
                const existing = String(item.content || "");
                return { ...item, content: `${existing}${token}`, chunks: [...(item.chunks || []), token], isStreaming: true, status: "streaming" };
              }));
              scrollActiveChatToBottom();
            }
          }
          if (eventName === "artifact") setActiveArtifact(payload);
          if (eventName === "tool_call") {
            const { name, args } = payload || {};
            if (name === "generate_video") {
              setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: "Video generation requested. Use the video mode to render this asset.", isStreaming: false, status: "complete" } : item));
            }
            if (name === "generate_image") {
              setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `Image generation requested: ${args?.prompt || trimmed}`, isStreaming: false, status: "complete" } : item));
            }
          }
          if (eventName === "complete") {
            const nextSessionId = payload?.sessionId;
            if (nextSessionId) {
              window.history.pushState(null, "", `/streams-ai/${nextSessionId}`);
              setSessionId(nextSessionId);
            }
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, status: "complete" } : item));
            setActivity(createActivity("complete", "chat", "Ready"));
            setIsStreaming(false);
            scrollActiveChatToBottom();
          }
          if (eventName === "error") throw new Error(payload?.message || payload?.error || "Chat failed");
        }
      }
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, status: "complete" } : item));
      setActivity(createActivity("complete", "chat", "Ready"));
      setIsStreaming(false);
    } catch (error) {
      const normalized = normalizeStreamsError(error);
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false, content: formatErrorForChat(normalized), status: "error" } : item));
      setActivity(createActivity("error", "chat", "Error"));
      setIsStreaming(false);
      scrollActiveChatToBottom();
    }
  }, [mounted, refreshSidebarData, updateMessageImage, sessionId, composerAttachments, selectedMode, selectedProvider]);

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
    removeComposerAttachment,
    forceTerminalChatFallback,
    composerAttachments,
    selectedMode,
    selectedProvider,
    setSelectedMode,
    setSelectedProvider,
    isLoadingMessages,
    selectSession: (id) => {
      window.history.pushState(null, "", `/streams-ai/${id}`);
      loadSessionMessages(id);
    },
    deleteSession: (id) => {
      deleteChatSession(id);
      deleteLibraryFile(id);
      refreshSidebarData();
      if (sessionId === id) newChat();
    },
    addMediaItem,
  }), [messages, activeArtifact, activity, isStreaming, sendMessage, newChat, sessionId, sessions, imageGallery, videoGallery, libraryFiles, shareCurrentChat, openImageViewer, closeImageViewer, viewerImage, viewerOpen, saveEditedImage, handleImageLoaded, copyAsset, saveAsset, shareAsset, uploadFiles, removeComposerAttachment, forceTerminalChatFallback, refreshSidebarData, selectedMode, selectedProvider, isLoadingMessages, loadSessionMessages]);

  return api;
}
