"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function normalizeMessage(row = {}) {
  return {
    id: row.id,
    role: row.role || "assistant",
    content: row.content || "",
    status: row.status || "complete",
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    ...(row.metadata || {}),
  };
}

export default function useAuthoritativeStreamsRuntime(baseRuntime) {
  const [serverMessages, setServerMessages] = useState([]);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const refreshGenerationRef = useRef(0);
  const previousStreamingRef = useRef(Boolean(baseRuntime?.isStreaming));

  const refreshMessages = useCallback(async () => {
    const sessionId = String(baseRuntime?.sessionId || "").trim();
    if (!sessionId || sessionId.startsWith("pending_")) {
      setServerMessages([]);
      return [];
    }

    const generation = ++refreshGenerationRef.current;
    setIsRefreshingMessages(true);
    try {
      const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}&limit=200`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Unable to refresh chat history");
      const rows = Array.isArray(data?.messages) ? data.messages.map(normalizeMessage) : [];
      if (generation === refreshGenerationRef.current) setServerMessages(rows);
      return rows;
    } finally {
      if (generation === refreshGenerationRef.current) setIsRefreshingMessages(false);
    }
  }, [baseRuntime?.sessionId]);

  useEffect(() => {
    setServerMessages([]);
    void refreshMessages().catch(() => {});
  }, [refreshMessages]);

  useEffect(() => {
    const wasStreaming = previousStreamingRef.current;
    const isStreaming = Boolean(baseRuntime?.isStreaming);
    previousStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) void refreshMessages().catch(() => {});
  }, [baseRuntime?.isStreaming, refreshMessages]);

  useEffect(() => {
    const refresh = () => void refreshMessages().catch(() => {});
    window.addEventListener("streams:chat-refresh-requested", refresh);
    return () => window.removeEventListener("streams:chat-refresh-requested", refresh);
  }, [refreshMessages]);

  const messages = useMemo(() => {
    if (baseRuntime?.isStreaming) return Array.isArray(baseRuntime?.messages) ? baseRuntime.messages : [];
    return serverMessages.length ? serverMessages : Array.isArray(baseRuntime?.messages) ? baseRuntime.messages : [];
  }, [baseRuntime?.isStreaming, baseRuntime?.messages, serverMessages]);

  return useMemo(() => ({
    ...baseRuntime,
    messages,
    refreshMessages,
    isRefreshingMessages,
  }), [baseRuntime, messages, refreshMessages, isRefreshingMessages]);
}
