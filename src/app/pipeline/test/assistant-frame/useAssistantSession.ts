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
  error: AssistantErrorMessage | null;
};

export type UseAssistantSessionOptions = {
  websocketUrl: string;
  initialContext?: Record<string, unknown>;
  autoConnect?: boolean;
  onWorkspaceAction?: (action: AssistantWorkspaceAction) => void | Promise<void>;
  /** Storage key for session persistence. Omit to disable persistence. */
  storageKey?: string;
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
  const existing = messages.find(
    (message) => message.turnId === turnId && message.role === "assistant",
  );

  if (existing) return messages;

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

    return {
      ...message,
      content: message.content + event.delta,
      status: "streaming",
    };
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

    if (event.type === "turn.completed") {
      return { ...message, status: "complete" };
    }

    if (event.type === "turn.cancelled") {
      return { ...message, status: "cancelled" };
    }

    return { ...message, status: "error" };
  });
}

export function useAssistantSession(
  options: UseAssistantSessionOptions,
): UseAssistantSessionApi {
  const { websocketUrl, initialContext, autoConnect = true, onWorkspaceAction, storageKey } = options;

  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingConnectRef = useRef<Promise<void> | null>(null);

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
  const [error, setError] = useState<AssistantErrorMessage | null>(null);

  const handleOutboundMessage = useCallback(
    async (message: AssistantSessionOutboundMessage) => {
      switch (message.type) {
        case "session.ready": {
          sessionIdRef.current = message.sessionId;
          setSession((previous) => ({
            ...previous,
            sessionId: message.sessionId,
            createdAt: message.createdAt,
          }));
          return;
        }

        case "session.state": {
          setSession((previous) => ({
            ...previous,
            sessionId: message.sessionId,
            status: message.status,
            activeTurnId: message.activeTurnId,
            previousResponseId: message.previousResponseId,
          }));
          return;
        }

        case "turn.started": {
          setMessages((previous) => ensureAssistantStreamingMessage(previous, message.turnId));
          return;
        }

        case "activity": {
          setActivities((previous) => ({
            ...previous,
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
          setMessages((previous) => updateAssistantStreamingDelta(previous, message));
          return;
        }

        case "turn.completed":
        case "turn.cancelled": {
          setMessages((previous) => finalizeAssistantTurn(previous, message));
          return;
        }

        case "error": {
          setError(message);
          setMessages((previous) => finalizeAssistantTurn(previous, message));
          return;
        }

        case "preview.created":
        case "preview.partial":
        case "preview.ready":
        case "preview.updated":
        case "preview.stale":
        case "preview.superseded": {
          setPreviews((previous) => ({
            ...previous,
            [message.preview.previewId]: message.preview,
          }));
          setPreviewsByTurn((previous) => {
            const existing = previous[message.turnId] ?? [];
            return existing.includes(message.preview.previewId)
              ? previous
              : { ...previous, [message.turnId]: [...existing, message.preview.previewId] };
          });
          return;
        }

        case "preview.closed": {
          setPreviews((previous) => {
            const next = { ...previous };
            delete next[message.previewId];
            return next;
          });
          setPreviewsByTurn((previous) => {
            const next = { ...previous };
            next[message.turnId] = (next[message.turnId] ?? []).filter(
              (id) => id !== message.previewId,
            );
            return next;
          });
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
    [onWorkspaceAction],
  );

  const connect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;
    if (pendingConnectRef.current) return pendingConnectRef.current;

    const run = new Promise<void>((resolve, reject) => {
      setConnectionState("connecting");
      setError(null);

      const socket = new WebSocket(websocketUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionState("connected");

        const startMessage: AssistantSessionInboundMessage = {
          type: "session.start",
          protocolVersion: ASSISTANT_PROTOCOL_VERSION,
          context: initialContext,
        };

        socket.send(JSON.stringify(startMessage));
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
          setError(transportError);
          return;
        }

        await handleOutboundMessage(outbound);
      });

      socket.addEventListener("close", () => {
        setConnectionState("closed");
      });

      socket.addEventListener("error", () => {
        setConnectionState("error");
        reject(new Error("WebSocket connection failed"));
      });
    }).finally(() => {
      pendingConnectRef.current = null;
    });

    pendingConnectRef.current = run;
    return run;
  }, [handleOutboundMessage, initialContext, websocketUrl]);

  const disconnect = useCallback(async () => {
    if (!socketRef.current) return;

    setConnectionState("closing");

    if (socketRef.current.readyState === WebSocket.OPEN) {
      const closeMessage: AssistantSessionInboundMessage = {
        type: "session.close",
        reason: "explicit_close",
      };
      socketRef.current.send(JSON.stringify(closeMessage));
    }

    socketRef.current.close();
    socketRef.current = null;
    setConnectionState("closed");
  }, []);

  const sendTurn = useCallback(
    async (message: string, options?: { context?: Record<string, unknown> }) => {
      if (!message.trim()) return null;
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("Assistant session is not connected");
      }
      // PRD §18: prevent overlapping turns — server also enforces this,
      // but guard at the client to avoid optimistic UI duplication.
      if (session.status === "running") {
        throw new Error("A turn is already in progress. Cancel it before sending a new one.");
      }

      const turnId = createId("turn");
      const createdAt = nowIso();

      setMessages((previous) => [
        ...previous,
        {
          id: createId("user_msg"),
          turnId,
          role: "user",
          content: message,
          status: "complete",
          createdAt,
        },
      ]);

      const payload: AssistantSessionInboundMessage = {
        type: "session.turn",
        turnId,
        message,
        context: options?.context,
      };

      socketRef.current.send(JSON.stringify(payload));
      return turnId;
    },
    [session.status],
  );

  const cancelTurn = useCallback(async (turnId?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("Assistant session is not connected");
    }

    const payload: AssistantSessionInboundMessage = {
      type: "session.cancel",
      turnId,
      reason: "explicit_cancel",
    };

    socketRef.current.send(JSON.stringify(payload));
  }, []);

  const sendWorkspaceAction = useCallback(
    async (action: AssistantWorkspaceAction, _turnId?: string) => {
      if (!onWorkspaceAction) return;
      await onWorkspaceAction(action);
    },
    [onWorkspaceAction],
  );

  useEffect(() => {
    if (!autoConnect) return;
    void connect();
    return () => {
      void disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Persist messages after each turn completes — not during streaming
  // to avoid one localStorage write per text delta.
  useEffect(() => {
    if (!storageKey) return;
    const isStreaming = messages.some((m) => m.status === "streaming");
    if (isStreaming) return;
    writePersistedSession(storageKey, messages);
  }, [messages, storageKey]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    if (storageKey) clearPersistedSession(storageKey);
  }, [storageKey]);

  const activePreview = useMemo(() => {
    const activeTurnId = session.activeTurnId;
    if (!activeTurnId) return null;
    const previewIds = previewsByTurn[activeTurnId] ?? [];
    const latestPreviewId = previewIds[previewIds.length - 1];
    return latestPreviewId ? previews[latestPreviewId] ?? null : null;
  }, [previews, previewsByTurn, session.activeTurnId]);

  return {
    connectionState,
    session,
    messages,
    activities,
    previews,
    previewsByTurn,
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

