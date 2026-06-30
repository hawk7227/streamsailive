"use client";

import { useEffect, useRef } from "react";

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
};

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

export default function BuilderContextEventSink() {
  const queueRef = useRef<BuilderContextEvent[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastKeyRef = useRef("");

  useEffect(() => {
    function flush() {
      const events = queueRef.current.splice(0, queueRef.current.length);
      if (!events.length) return;
      const blob = new Blob([JSON.stringify({ sessionId: "agent-1", events })], { type: "application/json" });
      navigator.sendBeacon?.("/api/streams-builder/context-events", blob);
      navigator.sendBeacon?.("/api/streams-ai/runtime-events", blob);
    }
    function enqueue(event: Event) {
      const detail = normalize((event as CustomEvent<BuilderContextEvent>).detail || {});
      if (!detail) return;
      const key = `${detail.phase}:${detail.message}:${detail.selectedLayerId || ""}:${detail.toolName || ""}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      queueRef.current.push(detail);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, 350);
    }
    window.addEventListener("streams-builder-summary-event", enqueue as EventListener);
    window.addEventListener("streams-builder:chat-context-event", enqueue as EventListener);
    window.addEventListener("streams-ai:runtime-event", enqueue as EventListener);
    return () => {
      window.removeEventListener("streams-builder-summary-event", enqueue as EventListener);
      window.removeEventListener("streams-builder:chat-context-event", enqueue as EventListener);
      window.removeEventListener("streams-ai:runtime-event", enqueue as EventListener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      flush();
    };
  }, []);
  return null;
}
