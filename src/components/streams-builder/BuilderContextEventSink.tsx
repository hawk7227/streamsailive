"use client";

import { useEffect, useRef } from "react";

const CONTEXT_KEY = "streams-builder:chat-context-events";
const CONVERSATION_KEY = "streams-ai:conversation-state";
const MAX_CONTEXT_EVENTS = 80;

type BuilderContextEvent = {
  phase?: string;
  type?: string;
  message?: string;
  reason?: string;
  source?: string;
  severity?: string;
  repo?: string;
  branch?: string;
  filePath?: string;
  path?: string;
  sourceFile?: string;
  route?: string;
  patchState?: string;
  draftDirty?: boolean;
  saved?: boolean;
  at?: string;
  selectedLayer?: unknown;
  selectedLayerId?: string;
  selectedLayerType?: string;
  attemptedAction?: string;
  riskLevel?: string;
  recommendations?: string[];
  toolName?: string;
  toolStatus?: string;
  jobId?: string;
  assetId?: string;
  providerRunId?: string;
  commitSha?: string;
  deploymentStatus?: string;
  error?: string;
  logs?: string[];
  metadata?: Record<string, unknown>;
  sessionId?: string;
  conversationState?: Record<string, unknown>;
  [key: string]: unknown;
};

function frame() {
  return document.querySelector<HTMLIFrameElement>("iframe[title='Streams AI']");
}

function remember(detail: BuilderContextEvent) {
  try {
    const current = JSON.parse(window.localStorage.getItem(CONTEXT_KEY) || "[]");
    const next = Array.isArray(current) ? current : [];
    window.localStorage.setItem(CONTEXT_KEY, JSON.stringify([...next, detail].slice(-MAX_CONTEXT_EVENTS)));
    if (detail.phase === "conversation-state" || String(detail.source || "").startsWith("streams-")) {
      window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify(detail));
    }
  } catch {}
}

function normalize(detail: BuilderContextEvent): BuilderContextEvent | null {
  const message = String(detail?.message || detail?.reason || detail?.error || "").trim();
  if (!message) return null;
  return {
    ...detail,
    at: detail.at || new Date().toISOString(),
    phase: detail.phase || detail.type || "builder-event",
    message,
    severity: detail.severity || (detail.riskLevel === "blocked" ? "warning" : "info"),
  };
}

function sessionIdFromEvents(events: BuilderContextEvent[]) {
  for (const event of events) {
    if (event.sessionId) return String(event.sessionId);
    const state = event.conversationState;
    if (state && typeof state === "object" && typeof state.sessionId === "string") return state.sessionId;
  }
  return "agent-1";
}

export default function BuilderContextEventSink() {
  const queueRef = useRef<BuilderContextEvent[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastKeyRef = useRef("");

  useEffect(() => {
    function flush() {
      const events = queueRef.current.splice(0, queueRef.current.length);
      if (!events.length) return;
      const sessionId = sessionIdFromEvents(events);
      const blob = new Blob([JSON.stringify({ sessionId, events })], { type: "application/json" });
      navigator.sendBeacon?.("/api/streams-builder/context-events", blob);
      navigator.sendBeacon?.("/api/streams-ai/runtime-events", blob);
    }
    function enqueue(event: Event) {
      const detail = normalize((event as CustomEvent<BuilderContextEvent>).detail || {});
      if (!detail) return;
      const key = `${detail.phase}:${detail.message}:${detail.selectedLayerId || ""}:${detail.toolName || ""}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      remember(detail);
      queueRef.current.push(detail);
      frame()?.contentWindow?.postMessage({ type: "streams-builder-context-event", detail, source: "builder-context-event-sink", at: detail.at }, window.location.origin);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, 350);
    }
    function onFrameMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (typeof data.type !== "string" || !data.type.startsWith("streams-ai:")) return;
      const detail = { ...(data.detail || {}), phase: data.type.replace(/^streams-ai:/, ""), source: data.source || "streams-ai-chat-frame", message: data.detail?.message || `${data.type.replace(/^streams-ai:/, "")} updated` };
      enqueue(new CustomEvent("streams-builder:chat-context-event", { detail }));
    }
    window.addEventListener("message", onFrameMessage);
    window.addEventListener("streams-builder-summary-event", enqueue as EventListener);
    window.addEventListener("streams-builder:chat-context-event", enqueue as EventListener);
    window.addEventListener("streams-ai:conversation-state", enqueue as EventListener);
    window.addEventListener("streams-ai:composer-draft-state", enqueue as EventListener);
    window.addEventListener("streams-ai:recent-chats-state", enqueue as EventListener);
    window.addEventListener("streams-ai:thread-assets-state", enqueue as EventListener);
    window.addEventListener("streams-ai:streaming-recovery-state", enqueue as EventListener);
    window.addEventListener("streams-ai:runtime-event", enqueue as EventListener);
    return () => {
      window.removeEventListener("message", onFrameMessage);
      window.removeEventListener("streams-builder-summary-event", enqueue as EventListener);
      window.removeEventListener("streams-builder:chat-context-event", enqueue as EventListener);
      window.removeEventListener("streams-ai:conversation-state", enqueue as EventListener);
      window.removeEventListener("streams-ai:composer-draft-state", enqueue as EventListener);
      window.removeEventListener("streams-ai:recent-chats-state", enqueue as EventListener);
      window.removeEventListener("streams-ai:thread-assets-state", enqueue as EventListener);
      window.removeEventListener("streams-ai:streaming-recovery-state", enqueue as EventListener);
      window.removeEventListener("streams-ai:runtime-event", enqueue as EventListener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      flush();
    };
  }, []);
  return null;
}
