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

/* ---------- ACTIVITY ---------- */

// ── Activity event names — truth-only, per pipeline spec Layer 6 ──────────
// Every emitted activity must correspond to a real system action.
// Extending this union requires a matching real backend event.
export type ActivityEventName =
  | "understanding"      // model is reasoning / routing
  | "reading_files"      // file retrieval in progress
  | "executing_tool"     // tool call dispatched to executor
  | "validating"         // output validation running
  | "completed"          // turn finished successfully
  | "failed"             // turn failed with error
  | "operation_skipped"; // tool or step intentionally skipped

export type AssistantActivityMessage = {
  type: "activity";
  turnId: string;
  activity: ActivityEventName;
  toolName?: string;
};

/* ---------- TEXT ---------- */

export type AssistantTextDeltaMessage = {
  type: "text.delta";
  turnId: string;
  delta: string;
};

/* ---------- TURN ---------- */

export type AssistantTurnStartedMessage = {
  type: "turn.started";
  sessionId: string;
  turnId: string;
  route?: string;
};

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
  title?: string;
  previewType: string;
  route: string;
  status: string;
};

/* ---------- WORKSPACE ---------- */

export type AssistantWorkspaceAction = {
  type: string;
  payload?: any;
};

/* ---------- OUTBOUND ---------- */

export type AssistantSessionOutboundMessage =
  | AssistantActivityMessage
  | AssistantTextDeltaMessage
  | AssistantTurnStartedMessage
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
    }
  | {
      type: "preview.created";
      turnId: string;
      preview: AssistantPreviewDescriptor;
    }
  | {
      type: "preview.partial";
      turnId: string;
      preview: AssistantPreviewDescriptor;
    }
  | {
      type: "preview.ready";
      turnId: string;
      preview: AssistantPreviewDescriptor;
    }
  | {
      type: "preview.updated";
      turnId: string;
      preview: AssistantPreviewDescriptor;
    }
  | {
      type: "preview.stale";
      turnId: string;
      preview: AssistantPreviewDescriptor;
    }
  | {
      type: "preview.superseded";
      turnId: string;
      preview: AssistantPreviewDescriptor;
    }
  | {
      type: "preview.closed";
      turnId: string;
      previewId: string;
    }
  | {
      type: "workspace.action";
      action: AssistantWorkspaceAction;
    }
  | {
      type: "tool.call";
      turnId: string;
      toolName?: string;
    }
  | {
      type: "tool.progress";
      turnId: string;
      toolName?: string;
      text?: string;
    }
  | {
      type: "tool.result";
      turnId: string;
      toolName?: string;
      result?: unknown;
    }
  | {
      type: "workspace.action.result";
      ok?: boolean;
    }
  | {
      type: "voice.state";
      state?: string;
    }
  | {
      type: "presence.state";
      state?: string;
    }
  | {
      type: "session.closed";
      sessionId?: string;
      reason?: string;
    };

/* ---------- TYPE GUARD ---------- */

export function isAssistantSessionOutboundMessage(
  value: any,
): value is AssistantSessionOutboundMessage {
  return typeof value === "object" && value !== null && typeof value.type === "string";
}
