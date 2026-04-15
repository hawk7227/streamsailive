export const ASSISTANT_PROTOCOL_VERSION = "1.0";

/* ---------- CONNECTION ---------- */

export type AssistantConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "closing"
  | "closed"
  | "error";

/* ---------- BASE ---------- */

export type AssistantBaseMessage = {
  type: string;
  sessionId?: string;
  turnId?: string;
};

/* ---------- INBOUND ---------- */

export type AssistantSessionInboundMessage =
  | {
      type: "session.start";
      protocolVersion: string;
      context?: Record<string, unknown>;
    }
  | {
      type: "session.turn";
      turnId: string;
      message: string;
      context?: Record<string, unknown>;
    }
  | {
      type: "session.cancel";
      turnId?: string;
      reason?: string;
    }
  | {
      type: "session.close";
      reason?: string;
    };

/* ---------- OUTBOUND ---------- */

export type AssistantSessionOutboundMessage =
  | AssistantActivityMessage
  | AssistantTextDeltaMessage
  | AssistantTurnCompletedMessage
  | AssistantTurnCancelledMessage
  | AssistantErrorMessage
  | {
      type: "session.ready";
      sessionId: string;
      createdAt: string;
    }
  | {
      type: "session.state";
      sessionId: string;
      status: "idle" | "running" | "closed";
      activeTurnId: string | null;
      previousResponseId: string | null;
    };

/* ---------- ACTIVITY ---------- */

export type AssistantActivityMessage = {
  type: "activity";
  turnId: string;
  activity: string;
  toolName?: string;
};

/* ---------- TEXT ---------- */

export type AssistantTextDeltaMessage = {
  type: "text.delta";
  turnId: string;
  delta: string;
};

/* ---------- TURN ---------- */

export type AssistantTurnCompletedMessage = {
  type: "turn.completed";
  turnId: string;
};

export type AssistantTurnCancelledMessage = {
  type: "turn.cancelled";
  turnId: string;
};

/* ---------- ERROR ---------- */

export type AssistantErrorMessage = {
  type: "error";
  sessionId: string;
  turnId?: string;
  scope: "transport" | "runtime" | "model";
  message: string;
  code?: string;
};

/* ---------- PREVIEW ---------- */

export type AssistantPreviewDescriptor = {
  previewId: string;
  turnId: string;
  type: string;
  status: string;
};

/* ---------- WORKSPACE ---------- */

export type AssistantWorkspaceAction = {
  type: string;
  payload?: any;
};

/* ---------- TYPE GUARD ---------- */

export function isAssistantSessionOutboundMessage(
  value: any
): value is AssistantSessionOutboundMessage {
  return typeof value === "object" && value !== null && typeof value.type === "string";
}
