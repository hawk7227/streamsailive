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

function normalizeSession(row = {}) {
  return {
    ...row,
    id: row.id,
    title: row.title || "New chat",
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export default function useAuthoritativeStreamsRuntime(baseRuntime) {
  const [serverMessages, setServerMessages] = useState([]);
  const [serverSessions, setServerSessions] = useState([]);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const refreshGenerationRef = useRef(0);
  const previousStreamingRef = useRef(Boolean(baseRuntime?.isStreaming));

  const refreshSessions = useCallback(async () => {
    const response = await fetch("/api/streams-ai/sessions", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || "Unable to refresh sessions");
    const rows = Array.isArray(data?.sessions) ? data.sessions.map(normalizeSession) : [];
    setServerSessions(rows);
    return rows;
  }, []);

  const refreshMessages = useCallback(async () => {
    const sessionId = String(baseRuntime?.sessionId || "").trim();
    if (!sessionId || sessionId.startsWith("pending_")) {
      setServerMessages([]);
      return [];
    }

    const generation = ++refreshGenerationRef.current;
    setIsRefreshingMessages(true);
    try {
      const response = await fetch(`/api/streams-ai/messages/page?sessionId=${encodeURIComponent(sessionId)}&limit=200`, {
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

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshSessions(), refreshMessages()]);
  }, [refreshMessages, refreshSessions]);

  useEffect(() => {
    setServerMessages([]);
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const wasStreaming = previousStreamingRef.current;
    const isStreaming = Boolean(baseRuntime?.isStreaming);
    previousStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) void refreshAll();
  }, [baseRuntime?.isStreaming, refreshAll]);

  useEffect(() => {
    const refresh = () => void refreshAll();
    const clear = () => {
      setServerMessages([]);
      setServerSessions([]);
    };
    window.addEventListener("streams:chat-refresh-requested", refresh);
    window.addEventListener("streams:auth-cache-cleared", clear);
    return () => {
      window.removeEventListener("streams:chat-refresh-requested", refresh);
      window.removeEventListener("streams:auth-cache-cleared", clear);
    };
  }, [refreshAll]);

  const messages = useMemo(() => {
    if (baseRuntime?.isStreaming) return Array.isArray(baseRuntime?.messages) ? baseRuntime.messages : [];
    return serverMessages.length ? serverMessages : Array.isArray(baseRuntime?.messages) ? baseRuntime.messages : [];
  }, [baseRuntime?.isStreaming, baseRuntime?.messages, serverMessages]);

  const sessions = serverSessions.length
    ? serverSessions
    : Array.isArray(baseRuntime?.sessions) ? baseRuntime.sessions : [];

  return useMemo(() => ({
    ...baseRuntime,
    messages,
    sessions,
    refreshMessages,
    refreshSessions,
    refreshAll,
    isRefreshingMessages,
  }), [baseRuntime, messages, sessions, refreshMessages, refreshSessions, refreshAll, isRefreshingMessages]);
}
