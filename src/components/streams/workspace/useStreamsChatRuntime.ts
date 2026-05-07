"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  StreamsRuntimeStatus,
  StreamsWorkspaceArtifact,
  StreamsWorkspaceMessage,
  StreamsWorkspaceSession,
} from "./types";

type BackendSession = {
  id: string;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type BackendMessage = {
  id: string;
  role: StreamsWorkspaceMessage["role"];
  content?: string | null;
  artifact_ids?: string[] | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type StreamsSseEvent = "activity" | "response" | "artifact" | "complete" | "error";

type RuntimeEvent = {
  event: StreamsSseEvent;
  data: Record<string, unknown>;
};

const USER_ID = process.env.NEXT_PUBLIC_STREAMS_TEST_USER_ID || "streams-test-user";
const WORKSPACE_ID = process.env.NEXT_PUBLIC_STREAMS_TEST_WORKSPACE_ID || "streams-public-test";

const idleStatus: StreamsRuntimeStatus = {
  phase: "idle",
  label: "READY",
  title: "Ready",
  subtitle: "Start a new message to run the Streams chat backend.",
};

function streamsHeaders() {
  return {
    "Content-Type": "application/json",
    "x-streams-user-id": USER_ID,
    "x-streams-workspace-id": WORKSPACE_ID,
  };
}

function sessionFromBackend(session: BackendSession): StreamsWorkspaceSession {
  return {
    id: session.id,
    title: session.title || "Untitled chat",
    createdAt: session.created_at ?? undefined,
    updatedAt: session.updated_at ?? undefined,
    metadata: session.metadata ?? undefined,
  };
}

function messageFromBackend(message: BackendMessage): StreamsWorkspaceMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content ?? "",
    artifactIds: message.artifact_ids ?? [],
    createdAt: message.created_at ?? undefined,
    metadata: message.metadata ?? undefined,
  };
}

function statusFromActivity(data: Record<string, unknown>): StreamsRuntimeStatus {
  return {
    phase: typeof data.phase === "string" ? (data.phase as StreamsRuntimeStatus["phase"]) : "thinking",
    label: typeof data.label === "string" ? data.label : "WORKING",
    title: typeof data.title === "string" ? data.title : typeof data.statusText === "string" ? data.statusText : "Working",
    subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
    mode: typeof data.mode === "string" ? data.mode : undefined,
    elapsedMs: typeof data.elapsedMs === "number" ? data.elapsedMs : undefined,
  };
}

function normalizeArtifact(data: Record<string, unknown>): StreamsWorkspaceArtifact {
  const id = typeof data.id === "string" ? data.id : `artifact_${Date.now()}`;
  const storageUrl =
    typeof data.storageUrl === "string"
      ? data.storageUrl
      : typeof data.storage_url === "string"
        ? data.storage_url
        : undefined;

  return {
    id,
    type: typeof data.type === "string" ? data.type : "file",
    title: typeof data.title === "string" ? data.title : "Generated artifact",
    code: typeof data.code === "string" ? data.code : undefined,
    language: typeof data.language === "string" ? data.language : undefined,
    preview: data.preview === true,
    suppressInChat: data.suppressInChat === true,
    storageUrl,
    thumbnailUrl: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : undefined,
    url: typeof data.url === "string" ? data.url : storageUrl,
    metadata: data,
  };
}

function parseSseChunk(buffer: string): { events: RuntimeEvent[]; rest: string } {
  const events: RuntimeEvent[] = [];
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";

  for (const frame of frames) {
    let event: StreamsSseEvent | null = null;
    const dataLines: string[] = [];

    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) {
        const value = line.slice(7).trim();
        if (["activity", "response", "artifact", "complete", "error"].includes(value)) {
          event = value as StreamsSseEvent;
        }
      }
      if (line.startsWith("data: ")) {
        dataLines.push(line.slice(6));
      }
    }

    if (!event) continue;
    try {
      const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      events.push({ event, data });
    } catch {
      events.push({ event: "error", data: { message: "Invalid stream event payload." } });
    }
  }

  return { events, rest };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  return payload;
}

export function useStreamsChatRuntime() {
  const [sessions, setSessions] = useState<StreamsWorkspaceSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StreamsWorkspaceMessage[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<StreamsWorkspaceArtifact | null>(null);
  const [status, setStatus] = useState<StreamsRuntimeStatus>(idleStatus);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const lastPromptRef = useRef<string>("");

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const persistMessage = useCallback(
    async (input: {
      sessionId: string;
      role: "user" | "assistant";
      content: string;
      artifactIds?: string[];
      metadata?: Record<string, unknown>;
    }) => {
      const response = await fetch(`/api/streams/chat/sessions/${input.sessionId}/messages`, {
        method: "POST",
        headers: streamsHeaders(),
        body: JSON.stringify({
          userId: USER_ID,
          workspaceId: WORKSPACE_ID,
          role: input.role,
          content: input.content,
          artifactIds: input.artifactIds ?? [],
          metadata: input.metadata ?? {},
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "Failed to persist message.");
        throw new Error(text || "Failed to persist message.");
      }
    },
    [],
  );

  const loadMessages = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/streams/chat/sessions/${sessionId}/messages`, {
      method: "GET",
      headers: streamsHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Failed to load messages.");
      throw new Error(text || "Failed to load messages.");
    }

    const payload = await readJson<{ data?: BackendMessage[] }>(response);
    setMessages((payload.data ?? []).map(messageFromBackend));
  }, []);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/streams/chat/sessions?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`,
        { method: "GET", headers: streamsHeaders() },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "Failed to load sessions.");
        throw new Error(text || "Failed to load sessions.");
      }

      const payload = await readJson<{ data?: BackendSession[] }>(response);
      const nextSessions = (payload.data ?? []).map(sessionFromBackend);
      setSessions(nextSessions);
      const nextActiveSessionId = activeSessionId ?? nextSessions[0]?.id ?? null;
      setActiveSessionId(nextActiveSessionId);
      if (nextActiveSessionId) {
        await loadMessages(nextActiveSessionId);
      } else {
        setMessages([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load sessions.");
      setSessions([]);
      setMessages([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [activeSessionId, loadMessages]);

  const createSession = useCallback(async (title = "New conversation") => {
    const response = await fetch("/api/streams/chat/sessions", {
      method: "POST",
      headers: streamsHeaders(),
      body: JSON.stringify({
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        title,
        activeTab: "chat",
        metadata: { source: "StreamsWorkspaceShell" },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Failed to create session.");
      throw new Error(text || "Failed to create session.");
    }

    const payload = await readJson<{ data?: BackendSession }>(response);
    if (!payload.data?.id) throw new Error("Session creation returned no session id.");

    const session = sessionFromBackend(payload.data);
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    setActiveSessionId(session.id);
    setMessages([]);
    setActiveArtifact(null);
    setStatus(idleStatus);
    setError(null);
    return session.id;
  }, []);

  const startNewChat = useCallback(async () => {
    try {
      await createSession();
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Failed to create session.";
      setError(messageText);
      setStatus({ phase: "error", label: "ERROR", title: "Session error", subtitle: messageText });
    }
  }, [createSession]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      setActiveSessionId(sessionId);
      setActiveArtifact(null);
      setError(null);
      try {
        await loadMessages(sessionId);
      } catch (caught) {
        const messageText = caught instanceof Error ? caught.message : "Failed to load messages.";
        setError(messageText);
        setStatus({ phase: "error", label: "ERROR", title: "Session error", subtitle: messageText });
      }
    },
    [loadMessages],
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      const message = prompt.trim();
      if (!message || isStreaming) return;

      setIsStreaming(true);
      setError(null);
      setStatus({ phase: "thinking", label: "THINKING", title: "Thinking", subtitle: "Connecting to /api/streams/chat." });
      lastPromptRef.current = message;

      const sessionId = activeSessionId ?? (await createSession(message.slice(0, 80)));
      const userMessage: StreamsWorkspaceMessage = {
        id: `local_user_${Date.now()}`,
        role: "user",
        content: message,
        artifactIds: [],
        createdAt: new Date().toISOString(),
      };
      const assistantMessageId = `local_assistant_${Date.now()}`;
      let assistantText = "";
      let artifactIds: string[] = [];
      let finalArtifact: StreamsWorkspaceArtifact | null = null;

      setMessages((current) => [
        ...current,
        userMessage,
        { id: assistantMessageId, role: "assistant", content: "", artifactIds: [], createdAt: new Date().toISOString() },
      ]);

      try {
        await persistMessage({ sessionId, role: "user", content: message });

        const response = await fetch("/api/streams/chat", {
          method: "POST",
          headers: streamsHeaders(),
          body: JSON.stringify({
            message,
            userId: USER_ID,
            projectId: WORKSPACE_ID,
          }),
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "Chat stream failed.");
          throw new Error(text || "Chat stream failed.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buffer);
          buffer = parsed.rest;

          for (const event of parsed.events) {
            if (event.event === "activity") {
              setStatus(statusFromActivity(event.data));
            }

            if (event.event === "response") {
              const token = typeof event.data.token === "string" ? event.data.token : "";
              if (!token) continue;
              assistantText += token;
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessageId ? { ...item, content: assistantText } : item,
                ),
              );
            }

            if (event.event === "artifact") {
              finalArtifact = normalizeArtifact(event.data);
              artifactIds = [finalArtifact.id];
              setActiveArtifact(finalArtifact);
              setIsPreviewOpen(true);
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessageId ? { ...item, artifactIds, metadata: { activeArtifact: finalArtifact } } : item,
                ),
              );
            }

            if (event.event === "complete") {
              setStatus({
                phase: "complete",
                label: "COMPLETE",
                title: "Complete",
                subtitle: "Response streamed and ready to persist.",
                elapsedMs: typeof event.data.elapsedMs === "number" ? event.data.elapsedMs : undefined,
              });
            }

            if (event.event === "error") {
              throw new Error(typeof event.data.message === "string" ? event.data.message : "Stream error.");
            }
          }
        }

        await persistMessage({
          sessionId,
          role: "assistant",
          content: assistantText,
          artifactIds,
          metadata: finalArtifact ? { activeArtifact: finalArtifact, persistedFromStream: true } : { persistedFromStream: true },
        });

        setStatus((current) => ({
          ...current,
          phase: "complete",
          label: "SAVED",
          title: "Complete and persisted",
          subtitle: "Assistant response was saved to the active session.",
        }));
        void loadSessions();
      } catch (caught) {
        const messageText = caught instanceof Error ? caught.message : "Unable to send message.";
        setError(messageText);
        setStatus({ phase: "error", label: "ERROR", title: "Error", subtitle: messageText });
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId && !item.content
              ? { ...item, content: "The Streams backend returned an error. Use retry after checking the status details." }
              : item,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [activeSessionId, createSession, isStreaming, loadSessions, persistMessage],
  );

  const retryLastMessage = useCallback(() => {
    if (!lastPromptRef.current || isStreaming) return;
    void sendMessage(lastPromptRef.current);
  }, [isStreaming, sendMessage]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return {
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    sessions,
    activeSession,
    activeSessionId,
    messages,
    activeArtifact,
    status,
    error,
    isStreaming,
    isLoadingSessions,
    isPreviewOpen,
    setIsPreviewOpen,
    createSession,
    startNewChat,
    selectSession,
    sendMessage,
    retryLastMessage,
    setActiveArtifact,
  };
}
