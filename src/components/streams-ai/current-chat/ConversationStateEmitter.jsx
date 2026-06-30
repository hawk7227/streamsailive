"use client";

import { useEffect, useRef } from "react";

const STATE_KEY = "streams-ai:conversation-state";
const CONTRACT_VERSION = "streams-ai-conversation-state.v1";
const SESSION_CACHE_KEY = "streams-ai:sessions.cache.v1";

function clip(value, max = 1600) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function currentPath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search || ""}`;
}

function sessionIdFromUrl() {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "streams-ai" && parts[1] ? parts[1] : "";
}

function readSessionCache() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_CACHE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lastMessage(messages = [], role) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (item?.role === role && String(item.content || "").trim()) return item;
  }
  return null;
}

function composerDraftLength() {
  try {
    const input = document.querySelector(".streamsComposerInput");
    return String(input?.value || "").length;
  } catch {
    return 0;
  }
}

function postRuntimeEvent(detail) {
  const sessionId = detail.sessionId || "agent-1";
  const body = JSON.stringify({ sessionId, events: [detail] });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/streams-ai/runtime-events", blob)) return;
  } catch {}
  try {
    fetch("/api/streams-ai/runtime-events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

function emit(type, detail) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STATE_KEY, JSON.stringify(detail)); } catch {}
  window.dispatchEvent(new CustomEvent(type, { detail }));
  try { window.parent?.postMessage({ type, detail, source: "streams-ai-chat-frame", at: new Date().toISOString() }, window.location.origin); } catch {}
  postRuntimeEvent(detail);
}

function buildState(chatRuntime) {
  const runtimeMessages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
  const runtimeSessions = Array.isArray(chatRuntime?.sessions) ? chatRuntime.sessions : [];
  const cachedSessions = typeof window !== "undefined" ? readSessionCache() : [];
  const sessionId = String(chatRuntime?.sessionId || sessionIdFromUrl() || "");
  const sessions = runtimeSessions.length ? runtimeSessions : cachedSessions;
  const activeSession = sessions.find((session) => session?.id === sessionId) || null;
  const messages = runtimeMessages.length ? runtimeMessages : Array.isArray(activeSession?.messages) ? activeSession.messages : [];
  const lastUser = lastMessage(messages, "user");
  const lastAssistant = lastMessage(messages, "assistant");
  return {
    contractVersion: CONTRACT_VERSION,
    phase: "conversation-state",
    source: chatRuntime ? "streams-chat-runtime" : "streams-chat-dom-bridge",
    message: `Conversation source of truth updated: session ${sessionId || "new"}, ${messages.length} messages, streaming ${chatRuntime?.isStreaming ? "yes" : "no"}.`,
    sessionId,
    path: currentPath(),
    chatTitle: activeSession?.title || "",
    messageCount: messages.length,
    lastUserMessage: clip(lastUser?.content, 4000),
    lastUserMessageId: lastUser?.id || "",
    lastAssistantMessage: clip(lastAssistant?.content, 4000),
    lastAssistantMessageId: lastAssistant?.id || "",
    isStreaming: Boolean(chatRuntime?.isStreaming),
    activityStatus: chatRuntime?.activity?.statusText || chatRuntime?.statusLabel || "Ready",
    activityPhase: chatRuntime?.activity?.phase || "",
    activityMode: chatRuntime?.activity?.mode || "",
    selectedMode: chatRuntime?.selectedMode || "",
    selectedProvider: chatRuntime?.selectedProvider || "",
    composerAttachmentCount: Array.isArray(chatRuntime?.composerAttachments) ? chatRuntime.composerAttachments.length : 0,
    composerAttachments: (Array.isArray(chatRuntime?.composerAttachments) ? chatRuntime.composerAttachments : []).slice(0, 12).map((file) => ({ id: file.id, name: file.name, kind: file.kind, mimeType: file.mimeType, status: file.status })),
    currentDraftLength: composerDraftLength(),
    activeArtifact: chatRuntime?.activeArtifact || null,
    libraryFilesCount: Array.isArray(chatRuntime?.libraryFiles) ? chatRuntime.libraryFiles.length : 0,
    sessionsCount: sessions.length,
    isLoadingMessages: Boolean(chatRuntime?.isLoadingMessages),
    imageGalleryCount: Array.isArray(chatRuntime?.imageGallery) ? chatRuntime.imageGallery.length : 0,
    videoGalleryCount: Array.isArray(chatRuntime?.videoGallery) ? chatRuntime.videoGallery.length : 0,
    viewerOpen: Boolean(chatRuntime?.viewerOpen),
    at: new Date().toISOString(),
  };
}

export default function ConversationStateEmitter({ chatRuntime = null }) {
  const lastKeyRef = useRef("");

  useEffect(() => {
    function publish() {
      const detail = buildState(chatRuntime);
      const key = JSON.stringify({ sessionId: detail.sessionId, path: detail.path, messageCount: detail.messageCount, lastUserMessageId: detail.lastUserMessageId, lastAssistantMessageId: detail.lastAssistantMessageId, isStreaming: detail.isStreaming, activityStatus: detail.activityStatus, selectedMode: detail.selectedMode, selectedProvider: detail.selectedProvider, composerAttachmentCount: detail.composerAttachmentCount, libraryFilesCount: detail.libraryFilesCount, sessionsCount: detail.sessionsCount, isLoadingMessages: detail.isLoadingMessages, currentDraftLength: detail.currentDraftLength });
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      emit("streams-ai:conversation-state", detail);
    }
    publish();
    const timer = window.setInterval(publish, chatRuntime ? 1200 : 1800);
    window.addEventListener("popstate", publish);
    window.addEventListener("streams:recent-chats-refresh", publish);
    window.addEventListener("streams:thread-assets-restored", publish);
    window.addEventListener("streams:images-changed", publish);
    window.addEventListener("streams:videos-changed", publish);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", publish);
      window.removeEventListener("streams:recent-chats-refresh", publish);
      window.removeEventListener("streams:thread-assets-restored", publish);
      window.removeEventListener("streams:images-changed", publish);
      window.removeEventListener("streams:videos-changed", publish);
    };
  }, [chatRuntime, chatRuntime?.sessionId, chatRuntime?.messages, chatRuntime?.isStreaming, chatRuntime?.activity, chatRuntime?.statusLabel, chatRuntime?.selectedMode, chatRuntime?.selectedProvider, chatRuntime?.composerAttachments, chatRuntime?.libraryFiles, chatRuntime?.sessions, chatRuntime?.isLoadingMessages, chatRuntime?.imageGallery, chatRuntime?.videoGallery, chatRuntime?.activeArtifact, chatRuntime?.viewerOpen]);

  return null;
}
