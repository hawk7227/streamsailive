"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadStoredMessages,
  writePersistedSession,
  clearPersistedSession,
} from "@/lib/utils/session-persistence";
import {
  ASSISTANT_PROTOCOL_VERSION,
  type AssistantActivityMessage,
  type AssistantConnectionState,
  type AssistantErrorMessage,
  type AssistantPreviewDescriptor,
  type AssistantSessionInboundMessage,
  type AssistantSessionOutboundMessage,
  type AssistantTextDeltaMessage,
  type AssistantTurnCancelledMessage,
  type AssistantTurnCompletedMessage,
  type AssistantWorkspaceAction,
  isAssistantSessionOutboundMessage,
} from "@/lib/assistant-core/assistant-protocol";
import {
  UIStateController,
  type ActivityStage,
  type RealtimeEvent,
  type ToolType,
  type TurnUIState,
} from "@/lib/ui-runtime";

// ── Types ─────────────────────────────────────────────────────────────────

export type AssistantChatMessage = {
  id: string;
  turnId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "streaming" | "complete" | "cancelled" | "error";
  createdAt: string;
};

export type AssistantTurnActivity = {
  turnId: string;
  activity: AssistantActivityMessage["activity"];
  toolName?: string;
  updatedAt: string;
};

/**
 * A resolved media artifact attached to a turn.
 * Replaces the previous markdown-injection approach (![Generated image](url)).
 * The client stores typed artifact state and renders ArtifactCard components.
 */
export type ArtifactDescriptor = {
  artifactId: string | null;
  turnId: string;
  url: string;
  mimeType: string;
  /** 'image' | 'video' | 'i2v' */
  mediaType: string;
  /** Truncated generation prompt — shown as label in ArtifactCard. */
  title: string | null;
  createdAt: string;
};

export type AssistantSessionSnapshot = {
  sessionId: string | null;
  status: "idle" | "running" | "closed";
  activeTurnId: string | null;
  previousResponseId: string | null;
  createdAt?: string;
};

export type AssistantSessionHookState = {
  connectionState: AssistantConnectionState;
  session: AssistantSessionSnapshot;
  messages: AssistantChatMessage[];
  activities: Record<string, AssistantTurnActivity>;
  previews: Record<string, AssistantPreviewDescriptor>;
  previewsByTurn: Record<string, string[]>;
  uiStates: Record<string, TurnUIState>;
  /** Keyed by turnId. Typed artifact metadata for rendering ArtifactCard. */
  artifactsByTurn: Record<string, ArtifactDescriptor>;
  error: AssistantErrorMessage | null;
};

export type UseAssistantSessionOptions = {
  websocketUrl: string;
  initialContext?: Record<string, unknown>;
  autoConnect?: boolean;
  onWorkspaceAction?: (action: AssistantWorkspaceAction) => void | Promise<void>;
  /** Storage key for session persistence. Omit to disable persistence. */
  storageKey?: string;
  /** conversationId for session index — passed to writePersistedSession. */
  conversationId?: string;
};

export type UseAssistantSessionApi = AssistantSessionHookState & {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearHistory: () => void;
  sendTurn: (
    message: string,
    options?: { context?: Record<string, unknown> },
  ) => Promise<string | null>;
  cancelTurn: (turnId?: string) => Promise<void>;
  sendWorkspaceAction: (
    action: AssistantWorkspaceAction,
    turnId?: string,
  ) => Promise<void>;
  isConnected: boolean;
  isTurnRunning: boolean;
  activePreview: AssistantPreviewDescriptor | null;
};

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1_000;
const STREAM_SAVE_DEBOUNCE_MS = 800; // §11: save during streaming, debounced

// ── Helpers ───────────────────────────────────────────────────────────────

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseMessageEvent(data: unknown): AssistantSessionOutboundMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data);
    return isAssistantSessionOutboundMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function ensureAssistantStreamingMessage(
  messages: AssistantChatMessage[],
  turnId: string,
): AssistantChatMessage[] {
  if (messages.some((m) => m.turnId === turnId && m.role === "assistant")) {
    return messages;
  }
  return [
    ...messages,
    {
      id: createId("assistant_msg"),
      turnId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: nowIso(),
    },
  ];
}

function updateAssistantStreamingDelta(
  messages: AssistantChatMessage[],
  event: AssistantTextDeltaMessage,
): AssistantChatMessage[] {
  const withMessage = ensureAssistantStreamingMessage(messages, event.turnId);
  return withMessage.map((message) => {
    if (message.turnId !== event.turnId || message.role !== "assistant") return message;
    return { ...message, content: message.content + event.delta, status: "streaming" };
  });
}

function finalizeAssistantTurn(
  messages: AssistantChatMessage[],
  event:
    | AssistantTurnCompletedMessage
    | AssistantTurnCancelledMessage
    | AssistantErrorMessage,
): AssistantChatMessage[] {
  return messages.map((message) => {
    if (!event.turnId || message.turnId !== event.turnId || message.role !== "assistant") {
      return message;
    }
    if (event.type === "turn.completed")  return { ...message, status: "complete" };
    if (event.type === "turn.cancelled")  return { ...message, status: "cancelled" };
    return { ...message, status: "error" };
  });
}



function isTranslatableActivityStage(stage: string): stage is ActivityStage {
  return (
    stage === "understanding" ||
    stage === "routing" ||
    stage === "building_context" ||
    stage === "calling_openai" ||
    stage === "streaming" ||
    stage === "executing_tool"
  );
}

function mapAssistantToolNameToToolType(toolName?: string): ToolType | undefined {
  switch (toolName) {
    case "generate_media":
      return "image";
    case "generate_song":
    case "generate_voice":
      return "audio";
    case "search_files":
    case "list_workspace_files":
    case "read_workspace_file":
      return "files";
    case "write_workspace_file":
    case "apply_workspace_patch":
      return "document";
    case "build_workspace":
    case "run_workspace_command":
    case "run_verification":
    case "send_workspace_action":
      return "build";
    case "list_conversation_artifacts":
      return "document";
    default:
      return undefined;
  }
}

function toRealtimeEvent(
  message: AssistantSessionOutboundMessage,
): RealtimeEvent | null {
  switch (message.type) {
    case "turn.started":
      return {
        type: "turn.started",
        turnId: message.turnId,
        timestamp: Date.now(),
      };

    case "session.state":
      if (!message.activeTurnId) return null;
      return {
        type: "session.state",
        turnId: message.activeTurnId,
        status:
          message.status === "running"
            ? "running"
            : message.status === "closed"
              ? "completed"
              : "idle",
        timestamp: Date.now(),
      };

    case "activity":
      if (!isTranslatableActivityStage(message.activity)) return null;
      return {
        type: "activity",
        turnId: message.turnId,
        stage: message.activity,
        tool: mapAssistantToolNameToToolType(message.toolName),
        timestamp: Date.now(),
      };

    case "text.delta":
      return {
        type: "text.delta",
        turnId: message.turnId,
        delta: message.delta,
        timestamp: Date.now(),
      };

    case "turn.completed":
      return {
        type: "response.completed",
        turnId: message.turnId,
        timestamp: Date.now(),
      };

    case "error":
      if (!message.turnId) return null;
      return {
        type: "response.failed",
        turnId: message.turnId,
        error: message.message,
        timestamp: Date.now(),
      };

    default:
      return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAssistantSession(
  options: UseAssistantSessionOptions,
): UseAssistantSessionApi {
  const {
    websocketUrl,
    initialContext,
    autoConnect = true,
    onWorkspaceAction,
    storageKey,
    conversationId,
  } = options;

  const socketRef              = useRef<WebSocket | null>(null);
  const sessionIdRef           = useRef<string | null>(null);
  // Tracks the latest previousResponseId so reconnect session.start can include it
  const previousResponseIdRef  = useRef<string | null>(null);
  const pendingConnectRef      = useRef<Promise<void> | null>(null);
  // §17: auto-reconnect state
  const reconnectAttemptsRef   = useRef(0);
  const reconnectTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explicitDisconnectRef  = useRef(false);
  const mountedRef             = useRef(true);
  // §11: streaming save debounce
  const streamSaveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest messages ref for use in closures without stale state
  const messagesRef            = useRef<AssistantChatMessage[]>([]);
  const uiStateControllerRef   = useRef(new UIStateController());
  // Deduplication: tracks how many text.delta events have been applied per turnId.
  // On WebSocket reconnect the server may replay SSE events — any delta whose
  // deltaIndex is less than the count already applied for that turn is dropped.
  const seenDeltaCountRef      = useRef<Map<string, number>>(new Map());

  const [connectionState, setConnectionState] =
    useState<AssistantConnectionState>("disconnected");
  const [session, setSession] = useState<AssistantSessionSnapshot>({
    sessionId: null,
    status: "idle",
    activeTurnId: null,
    previousResponseId: null,
  });
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() =>
    storageKey ? loadStoredMessages(storageKey) : [],
  );
  const [activities, setActivities] = useState<Record<string, AssistantTurnActivity>>({});
  const [previews, setPreviews] = useState<Record<string, AssistantPreviewDescriptor>>({});
  const [previewsByTurn, setPreviewsByTurn] = useState<Record<string, string[]>>({});
  const [artifactsByTurn, setArtifactsByTurn] = useState<Record<string, ArtifactDescriptor>>({});
  const [uiStates, setUIStates] = useState<Record<string, TurnUIState>>({});
  const [error, setError] = useState<AssistantErrorMessage | null>(null);

  // Keep messagesRef in sync for closures
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Track mount state to avoid setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Streaming save (§11) ──────────────────────────────────────────────
  // Debounced — fires 800ms after the last received delta.
  // Does not write on every token; avoids one localStorage write per delta.
  const scheduleStreamSave = useCallback(() => {
    if (!storageKey) return;
    if (streamSaveTimerRef.current) clearTimeout(streamSaveTimerRef.current);
    streamSaveTimerRef.current = setTimeout(() => {
      if (storageKey) {
        writePersistedSession(storageKey, messagesRef.current, conversationId);
      }
    }, STREAM_SAVE_DEBOUNCE_MS);
  }, [storageKey, conversationId]);

  const applyRealtimeUIState = useCallback((event: RealtimeEvent) => {
    const next = uiStateControllerRef.current.update(event);
    if (!next) return;

    setUIStates((current) => ({
      ...current,
      [next.turnId]: next,
    }));

    if (event.type === "response.completed" || event.type === "response.failed") {
      uiStateControllerRef.current.clear(event.turnId);
    }
  }, []);

  const applyMessageUIState = useCallback((message: AssistantSessionOutboundMessage) => {
    const event = toRealtimeEvent(message);
    if (!event) return;
    applyRealtimeUIState(event);
  }, [applyRealtimeUIState]);

  // ── Message event handler ─────────────────────────────────────────────
  const handleOutboundMessage = useCallback(
    async (message: AssistantSessionOutboundMessage) => {
      if (!mountedRef.current) return;

      applyMessageUIState(message);

      switch (message.type) {
        case "session.ready": {
          sessionIdRef.current = message.sessionId;
          setSession((prev) => ({
            ...prev,
            sessionId: message.sessionId,
            createdAt: message.createdAt,
          }));
          return;
        }

        case "session.state": {
          // Keep ref in sync so the reconnect session.start can read it without
          // stale closure issues — React state is not readable in WS callbacks.
          previousResponseIdRef.current = message.previousResponseId;
          setSession((prev) => ({
            ...prev,
            sessionId: message.sessionId,
            status: message.status,
            activeTurnId: message.activeTurnId,
            previousResponseId: message.previousResponseId,
          }));
          return;
        }

        case "turn.started": {
          setMessages((prev) => ensureAssistantStreamingMessage(prev, message.turnId));
          return;
        }

        case "activity": {
          setActivities((prev) => ({
            ...prev,
            [message.turnId]: {
              turnId: message.turnId,
              activity: message.activity,
              toolName: message.toolName,
              updatedAt: nowIso(),
            },
          }));
          return;
        }

        case "text.delta": {
          // Deduplication guard — drop any delta whose index is below what we
          // have already applied for this turn. This prevents double-appending
          // on WebSocket reconnect if the server replays SSE events.
          const seenCount = seenDeltaCountRef.current.get(message.turnId) ?? 0;
          if (message.deltaIndex < seenCount) {
            // Already applied — drop silently
            return;
          }
          seenDeltaCountRef.current.set(message.turnId, message.deltaIndex + 1);

          setMessages((prev) => {
            const next = updateAssistantStreamingDelta(prev, message);
            // Update ref immediately so scheduleStreamSave sees latest content
            messagesRef.current = next;
            return next;
          });
          scheduleStreamSave(); // §11: debounced save during streaming
          return;
        }

        case "turn.completed":
        case "turn.cancelled": {
          // Clean up dedup tracking for this turn — free memory, prevent stale state
          if (message.turnId) seenDeltaCountRef.current.delete(message.turnId);
          setMessages((prev) => finalizeAssistantTurn(prev, message));
          return;
        }

        case "error": {
          setError(message);
          setMessages((prev) => finalizeAssistantTurn(prev, message));
          return;
        }

        case "preview.created":
        case "preview.partial":
        case "preview.ready":
        case "preview.updated":
        case "preview.stale":
        case "preview.superseded": {
          setPreviews((prev) => ({ ...prev, [message.preview.previewId]: message.preview }));
          setPreviewsByTurn((prev) => {
            const existing = prev[message.turnId] ?? [];
            return existing.includes(message.preview.previewId)
              ? prev
              : { ...prev, [message.turnId]: [...existing, message.preview.previewId] };
          });
          return;
        }

        case "preview.closed": {
          setPreviews((prev) => { const next = { ...prev }; delete next[message.previewId]; return next; });
          setPreviewsByTurn((prev) => {
            const next = { ...prev };
            next[message.turnId] = (next[message.turnId] ?? []).filter((id) => id !== message.previewId);
            return next;
          });
          return;
        }

        case "image.ready": {
          // Store typed artifact descriptor — ArtifactCard renders from this,
          // not from markdown injection in message.content.
          setArtifactsByTurn((prev) => ({
            ...prev,
            [message.turnId]: {
              artifactId: message.artifactId ?? null,
              turnId: message.turnId,
              url: message.url,
              mimeType: message.mimeType ?? "image/png",
              mediaType: message.mediaType ?? "image",
              title: message.title ?? null,
              createdAt: new Date().toISOString(),
            },
          }));
          // Mark the assistant message complete
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.turnId !== message.turnId || msg.role !== "assistant") return msg;
              return { ...msg, status: "complete" };
            }),
          );
          return;
        }

        case "video.ready": {
          // Store typed artifact descriptor — ArtifactCard renders from this.
          setArtifactsByTurn((prev) => ({
            ...prev,
            [message.turnId]: {
              artifactId: message.artifactId ?? null,
              turnId: message.turnId,
              url: message.url,
              mimeType: message.mimeType ?? "video/mp4",
              mediaType: message.mediaType ?? "video",
              title: message.title ?? null,
              createdAt: new Date().toISOString(),
            },
          }));
          // Mark the assistant message complete
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.turnId !== message.turnId || msg.role !== "assistant") return msg;
              return { ...msg, status: "complete" };
            }),
          );
          return;
        }

        case "workspace.action": {
          await onWorkspaceAction?.(message.action);
          return;
        }

        case "tool.call":
        case "tool.progress":
        case "tool.result":
        case "workspace.action.result":
        case "voice.state":
        case "presence.state":
        case "session.closed": {
          return;
        }
      }
    },
    [applyMessageUIState, onWorkspaceAction, scheduleStreamSave],
  );

  // ── Connect (§17: with auto-reconnect backing) ─────────────────────────
  const connect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;
    if (pendingConnectRef.current) return pendingConnectRef.current;

    const run = new Promise<void>((resolve, reject) => {
      if (!mountedRef.current) return;
      setConnectionState("connecting");
      setError(null);

      const socket = new WebSocket(websocketUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (!mountedRef.current) return;
        // Successful connect — reset backoff counter
        reconnectAttemptsRef.current = 0;
        setConnectionState("connected");

        socket.send(
          JSON.stringify({
            type: "session.start",
            protocolVersion: ASSISTANT_PROTOCOL_VERSION,
            context: initialContext,
            // On reconnect: pass the last known previousResponseId so the server
            // can restore it. On initial connect this will be null (no-op).
            previousResponseId: previousResponseIdRef.current,
          } satisfies AssistantSessionInboundMessage),
        );
        resolve();
      });

      socket.addEventListener("message", async (event) => {
        const outbound = parseMessageEvent(event.data);
        if (!outbound) {
          const transportError: AssistantErrorMessage = {
            type: "error",
            sessionId: sessionIdRef.current ?? "unknown",
            scope: "transport",
            message: "Malformed outbound assistant protocol payload",
            code: "MALFORMED_OUTBOUND_PROTOCOL_PAYLOAD",
          };
          if (mountedRef.current) setError(transportError);
          return;
        }
        await handleOutboundMessage(outbound);
      });

      socket.addEventListener("close", () => {
        if (!mountedRef.current) return;
        setConnectionState("closed");

        // §17: Auto-reconnect with exponential backoff.
        // Only fires if the disconnect was not initiated by the user.
        if (
          !explicitDisconnectRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttemptsRef.current,
            16_000,
          );
          reconnectAttemptsRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current && !explicitDisconnectRef.current) {
              void connect();
            }
          }, delay);
        }
      });

      socket.addEventListener("error", () => {
        if (mountedRef.current) setConnectionState("error");
        reject(new Error("WebSocket connection failed"));
      });
    }).finally(() => {
      pendingConnectRef.current = null;
    });

    pendingConnectRef.current = run;
    return run;
  }, [handleOutboundMessage, initialContext, websocketUrl]);

  // ── Disconnect ────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    explicitDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (!socketRef.current) return;
    setConnectionState("closing");
    if (socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "session.close", reason: "explicit_close" } satisfies AssistantSessionInboundMessage),
      );
    }
    socketRef.current.close();
    socketRef.current = null;
    setConnectionState("closed");
  }, []);

  // ── Send turn ─────────────────────────────────────────────────────────
  const sendTurn = useCallback(
    async (message: string, options?: { context?: Record<string, unknown> }) => {
      if (!message.trim()) return null;
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("Assistant session is not connected");
      }
      // PRD §18: prevent overlapping turns
      if (session.status === "running") {
        throw new Error("A turn is already in progress. Cancel it before sending a new one.");
      }

      const turnId = createId("turn");

      setMessages((prev) => [
        ...prev,
        { id: createId("user_msg"), turnId, role: "user", content: message, status: "complete", createdAt: nowIso() },
      ]);

      applyRealtimeUIState({
        type: "turn.started",
        turnId,
        timestamp: Date.now(),
      });

      applyRealtimeUIState({
        type: "session.state",
        turnId,
        status: "running",
        timestamp: Date.now(),
      });

      socketRef.current.send(
        JSON.stringify({
          type: "session.turn",
          turnId,
          message,
          context: options?.context,
        } satisfies AssistantSessionInboundMessage),
      );
      return turnId;
    },
    [applyRealtimeUIState, session.status],
  );

  // ── Cancel turn ───────────────────────────────────────────────────────
  const cancelTurn = useCallback(async (turnId?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("Assistant session is not connected");
    }
    socketRef.current.send(
      JSON.stringify({ type: "session.cancel", turnId, reason: "explicit_cancel" } satisfies AssistantSessionInboundMessage),
    );
  }, []);

  const sendWorkspaceAction = useCallback(
    async (action: AssistantWorkspaceAction, _turnId?: string) => {
      if (!onWorkspaceAction) return;
      await onWorkspaceAction(action);
    },
    [onWorkspaceAction],
  );

  // ── Auto-connect on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!autoConnect) return;
    explicitDisconnectRef.current = false;
    void connect();
    return () => {
      explicitDisconnectRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      void disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist on turn complete ──────────────────────────────────────────
  // The streaming save (debounced 800ms) handles in-progress turns.
  // This handles the final durable write after each completed turn.
  useEffect(() => {
    if (!storageKey) return;
    const isStreaming = messages.some((m) => m.status === "streaming");
    if (isStreaming) return;
    writePersistedSession(storageKey, messages, conversationId);
  }, [messages, storageKey, conversationId]);

  // ── Clear history ─────────────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    setMessages([]);
    setActivities({});
    setPreviews({});
    setPreviewsByTurn({});
    setArtifactsByTurn({});
    setUIStates({});
    uiStateControllerRef.current.reset();
    if (storageKey) clearPersistedSession(storageKey);
  }, [storageKey]);

  // ── Active preview ────────────────────────────────────────────────────
  const activePreview = useMemo(() => {
    const tid = session.activeTurnId;
    if (!tid) return null;
    const ids = previewsByTurn[tid] ?? [];
    const last = ids[ids.length - 1];
    return last ? previews[last] ?? null : null;
  }, [previews, previewsByTurn, session.activeTurnId]);

  return {
    connectionState,
    session,
    messages,
    activities,
    previews,
    previewsByTurn,
    artifactsByTurn,
    uiStates,
    error,
    connect,
    disconnect,
    clearHistory,
    sendTurn,
    cancelTurn,
    sendWorkspaceAction,
    isConnected: connectionState === "connected",
    isTurnRunning: session.status === "running",
    activePreview,
  };
}
