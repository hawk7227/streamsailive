"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type ChatMessage = {
  id: string;
  turnId?: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "complete" | "cancelled" | "error";
  createdAt: string;
};

type Activity = {
  turnId: string;
  activity: AssistantActivityMessage["activity"];
  toolName?: string;
  updatedAt: string;
};

type SessionState = {
  sessionId: string | null;
  status: "idle" | "running" | "closed";
  activeTurnId: string | null;
  previousResponseId: string | null;
};

type Options = {
  websocketUrl: string;
  initialContext?: Record<string, unknown>;
  autoConnect?: boolean;
  onWorkspaceAction?: (action: AssistantWorkspaceAction) => void | Promise<void>;
};

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

export function useAssistantSession(options: Options) {
  const { websocketUrl, initialContext, autoConnect = true, onWorkspaceAction } = options;

  const socketRef = useRef<WebSocket | null>(null);

  const [connectionState, setConnectionState] =
    useState<AssistantConnectionState>("disconnected");

  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    status: "idle",
    activeTurnId: null,
    previousResponseId: null,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activities, setActivities] = useState<Record<string, Activity>>({});
  const [previews, setPreviews] = useState<Record<string, AssistantPreviewDescriptor>>({});
  const [previewsByTurn, setPreviewsByTurn] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<AssistantErrorMessage | null>(null);

  const handleMessage = useCallback(
    async (msg: AssistantSessionOutboundMessage) => {
      switch (msg.type) {
        case "session.ready":
          setSession((s) => ({ ...s, sessionId: msg.sessionId }));
          return;

        case "session.state":
          setSession({
            sessionId: msg.sessionId,
            status: msg.status,
            activeTurnId: msg.activeTurnId,
            previousResponseId: msg.previousResponseId,
          });
          return;

        case "turn.started":
          setMessages((m) => [
            ...m,
            {
              id: id("assistant"),
              turnId: msg.turnId,
              role: "assistant",
              content: "",
              status: "streaming",
              createdAt: now(),
            },
          ]);
          return;

        case "text.delta":
          setMessages((m) =>
            m.map((x) =>
              x.turnId === msg.turnId && x.role === "assistant"
                ? { ...x, content: x.content + msg.delta }
                : x,
            ),
          );
          return;

        case "activity":
          setActivities((a) => ({
            ...a,
            [msg.turnId]: {
              turnId: msg.turnId,
              activity: msg.activity,
              toolName: msg.toolName,
              updatedAt: now(),
            },
          }));
          return;

        case "turn.completed":
        case "turn.cancelled":
          setMessages((m) =>
            m.map((x) =>
              x.turnId === msg.turnId && x.role === "assistant"
                ? {
                    ...x,
                    status: msg.type === "turn.completed" ? "complete" : "cancelled",
                  }
                : x,
            ),
          );
          return;

        case "error":
          setError(msg);
          return;

        case "preview.created":
        case "preview.partial":
        case "preview.ready":
        case "preview.updated":
        case "preview.stale":
        case "preview.superseded":
          setPreviews((p) => ({
            ...p,
            [msg.preview.previewId]: msg.preview,
          }));

          setPreviewsByTurn((map) => {
            const list = map[msg.turnId] || [];
            if (list.includes(msg.preview.previewId)) return map;
            return {
              ...map,
              [msg.turnId]: [...list, msg.preview.previewId],
            };
          });

          return;

        case "workspace.action":
          await onWorkspaceAction?.(msg.action);
          return;

        default:
          return;
      }
    },
    [onWorkspaceAction],
  );

  const connect = useCallback(async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState("connecting");

    const ws = new WebSocket(websocketUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");

      const start: AssistantSessionInboundMessage = {
        type: "session.start",
        protocolVersion: ASSISTANT_PROTOCOL_VERSION,
        context: initialContext,
      };

      ws.send(JSON.stringify(start));
    };

    ws.onmessage = async (event) => {
      const parsed = JSON.parse(event.data);

      if (!isAssistantSessionOutboundMessage(parsed)) return;

      await handleMessage(parsed);
    };

    ws.onclose = () => setConnectionState("closed");
    ws.onerror = () => setConnectionState("error");
  }, [handleMessage, websocketUrl, initialContext]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setConnectionState("closed");
  }, []);

  const sendTurn = useCallback(async (text: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    const turnId = id("turn");

    setMessages((m) => [
      ...m,
      {
        id: id("user"),
        turnId,
        role: "user",
        content: text,
        status: "complete",
        createdAt: now(),
      },
    ]);

    const msg: AssistantSessionInboundMessage = {
      type: "session.turn",
      turnId,
      message: text,
    };

    socketRef.current.send(JSON.stringify(msg));
    return turnId;
  }, []);

  const cancelTurn = useCallback(async (turnId?: string) => {
    socketRef.current?.send(
      JSON.stringify({
        type: "session.cancel",
        turnId,
        reason: "explicit_cancel",
      }),
    );
  }, []);

  useEffect(() => {
    if (!autoConnect) return;
    connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  const activePreview = useMemo(() => {
    const turnId = session.activeTurnId;
    if (!turnId) return null;

    const ids = previewsByTurn[turnId] || [];
    const last = ids[ids.length - 1];
    return last ? previews[last] : null;
  }, [session.activeTurnId, previewsByTurn, previews]);

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
    sendTurn,
    cancelTurn,
    isConnected: connectionState === "connected",
    isTurnRunning: session.status === "running",
    activePreview,
  };
}
