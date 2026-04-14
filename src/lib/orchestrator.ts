/**
 * Shared assistant session protocol.
 *
 * Single contract between:
 * - frontend session client
 * - realtime transport / websocket adapter
 * - session control plane / orchestrator
 *
 * Transport-agnostic, UI-agnostic, persistence-agnostic.
 */

export const ASSISTANT_PROTOCOL_VERSION = "1" as const;

export type AssistantSessionStatus = "idle" | "running" | "closed";

export type AssistantConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "closing"
  | "closed"
  | "error";

export type AssistantActivityType =
  | "understanding"
  | "reading_files"
  | "executing_tool"
  | "validating"
  | "completed"
  | "failed"
  | "operation_skipped";

export type AssistantCloseReason =
  | "client_disconnect"
  | "explicit_close"
  | "explicit_cancel"
  | "timeout"
  | "protocol_error"
  | "auth_failure"
  | "transport_closed"
  | "server_shutdown"
  | "turn_failed";

export type AssistantErrorScope =
  | "session"
  | "provider"
  | "tool"
  | "transport"
  | "orchestrator"
  | "preview"
  | "voice"
  | "workspace"
  | "editor";

export type AssistantPreviewRoute = "inline" | "companion";

export type AssistantPreviewStatus =
  | "created"
  | "partial"
  | "ready"
  | "failed"
  | "stale"
  | "superseded"
  | "closed";

export type AssistantPreviewType =
  | "image"
  | "video"
  | "app_runtime"
  | "page_editor"
  | "document"
  | "code_output"
  | "diff"
  | "build_result"
  | "artifact_collection";

export type AssistantWorkspaceActionType =
  | "WORKSPACE_SET_LAYOUT_MODE"
  | "WORKSPACE_FOCUS_PANEL"
  | "WORKSPACE_RESIZE_PANEL"
  | "WORKSPACE_TOGGLE_CHAT"
  | "WORKSPACE_TOGGLE_SESSION_TOOLBAR"
  | "WORKSPACE_OPEN_EDITORPRO"
  | "WORKSPACE_CLOSE_EDITORPRO"
  | "WORKSPACE_SET_EDITORPRO_WIDTH"
  | "WORKSPACE_SET_TAB"
  | "PREVIEW_OPEN_ARTIFACT"
  | "PREVIEW_SET_ACTIVE"
  | "PREVIEW_PIN"
  | "PREVIEW_UNPIN"
  | "PREVIEW_SET_VIEW_MODE"
  | "PREVIEW_SET_DEVICE_FRAME"
  | "PREVIEW_COMPARE_ARTIFACTS"
  | "MEDIA_SHELF_SELECT_ITEM"
  | "MEDIA_SHELF_SCROLL_TO_ITEM"
  | "MEDIA_SHELF_SET_ACTIVE"
  | "MEDIA_SHELF_PLAY_VIDEO"
  | "MEDIA_SHELF_PAUSE_VIDEO"
  | "GENERATOR_RUN_IMAGE"
  | "GENERATOR_RUN_VIDEO"
  | "GENERATOR_RUN_I2V"
  | "GENERATOR_RUN_BULK"
  | "GENERATOR_SELECT_MODEL"
  | "GENERATOR_SET_PROMPT"
  | "GENERATOR_SET_ASPECT_RATIO"
  | "GENERATOR_SET_DURATION"
  | "PIPELINE_FOCUS_STEP"
  | "PIPELINE_SHOW_PHASE"
  | "PIPELINE_FOLLOW_JOB"
  | "PIPELINE_SHOW_VALIDATION_RESULT"
  | "EDITORPRO_SET_DEVICE"
  | "EDITORPRO_SET_BROWSER"
  | "EDITORPRO_SET_ZOOM"
  | "EDITORPRO_RESET_ZOOM"
  | "EDITORPRO_SET_MODE"
  | "EDITORPRO_SET_REPO"
  | "EDITORPRO_SET_BRANCH"
  | "EDITORPRO_SET_FILE"
  | "EDITORPRO_PULL_FILE"
  | "EDITORPRO_PUSH_FILE"
  | "EDITORPRO_OPEN_GITHUB_PANEL"
  | "EDITORPRO_OPEN_PROPERTIES_PANEL"
  | "EDITORPRO_CLOSE_PANEL"
  | "EDITORPRO_SELECT_ELEMENT"
  | "EDITORPRO_CLEAR_SELECTION"
  | "EDITORPRO_SET_TEXT"
  | "EDITORPRO_SET_STYLE"
  | "EDITORPRO_MOVE_ELEMENT"
  | "EDITORPRO_RESIZE_ELEMENT"
  | "EDITORPRO_APPLY_SWATCH_COLOR";

export type AssistantWorkspaceAction = {
  actionType: AssistantWorkspaceActionType;
  payload?: Record<string, unknown>;
};

export type AssistantClientMessageInput = {
  role?: string;
  content?: unknown;
};

export type AssistantErrorPayload = {
  scope: AssistantErrorScope;
  message: string;
  code?: string;
  turnId?: string;
  toolName?: string;
};

export type AssistantPreviewDescriptor = {
  previewId: string;
  artifactId: string;
  sessionId: string;
  sourceTurnId: string;
  previewType: AssistantPreviewType;
  route: AssistantPreviewRoute;
  version: number;
  status: AssistantPreviewStatus;
  title?: string;
  sourceTool?: string;
  sourceJobId?: string;
  sourceFilePath?: string;
  sourceRoute?: string;
  supersedesPreviewId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AssistantSessionStartMessage = {
  type: "session.start";
  protocolVersion: typeof ASSISTANT_PROTOCOL_VERSION | string;
  sessionId?: string;
  context?: Record<string, unknown>;
};

export type AssistantSessionTurnMessage = {
  type: "session.turn";
  turnId?: string;
  message: string;
  messages?: AssistantClientMessageInput[];
  context?: Record<string, unknown>;
};

export type AssistantSessionCancelMessage = {
  type: "session.cancel";
  turnId?: string;
  reason?: AssistantCloseReason;
};

export type AssistantSessionCloseMessage = {
  type: "session.close";
  reason?: AssistantCloseReason;
};

export type AssistantSessionInboundMessage =
  | AssistantSessionStartMessage
  | AssistantSessionTurnMessage
  | AssistantSessionCancelMessage
  | AssistantSessionCloseMessage;

export type AssistantSessionReadyMessage = {
  type: "session.ready";
  sessionId: string;
  createdAt: string;
};

export type AssistantSessionStateMessage = {
  type: "session.state";
  sessionId: string;
  status: AssistantSessionStatus;
  activeTurnId: string | null;
  previousResponseId: string | null;
};

export type AssistantTurnStartedMessage = {
  type: "turn.started";
  sessionId: string;
  turnId: string;
  route: string;
};

export type AssistantActivityMessage = {
  type: "activity";
  sessionId: string;
  turnId: string;
  activity: AssistantActivityType;
  toolName?: string;
};

export type AssistantTextDeltaMessage = {
  type: "text.delta";
  sessionId: string;
  turnId: string;
  delta: string;
};

export type AssistantToolCallMessage = {
  type: "tool.call";
  sessionId: string;
  turnId: string;
  callId: string;
  toolName: string;
};

export type AssistantToolProgressMessage = {
  type: "tool.progress";
  sessionId: string;
  turnId: string;
  toolName: string;
  text: string;
};

export type AssistantToolResultMessage = {
  type: "tool.result";
  sessionId: string;
  turnId: string;
  toolName: string;
  result: unknown;
};

export type AssistantTurnCompletedMessage = {
  type: "turn.completed";
  sessionId: string;
  turnId: string;
  responseId: string | null;
  sawText: boolean;
};

export type AssistantTurnCancelledMessage = {
  type: "turn.cancelled";
  sessionId: string;
  turnId: string;
  reason: string;
};

export type AssistantErrorMessage = {
  type: "error";
  sessionId: string;
} & AssistantErrorPayload;

export type AssistantSessionClosedMessage = {
  type: "session.closed";
  sessionId: string;
  reason?: string;
};

export type AssistantPreviewCreatedMessage = {
  type: "preview.created";
  sessionId: string;
  turnId: string;
  preview: AssistantPreviewDescriptor;
};

export type AssistantPreviewPartialMessage = {
  type: "preview.partial";
  sessionId: string;
  turnId: string;
  preview: AssistantPreviewDescriptor;
};

export type AssistantPreviewReadyMessage = {
  type: "preview.ready";
  sessionId: string;
  turnId: string;
  preview: AssistantPreviewDescriptor;
};

export type AssistantPreviewFailedMessage = {
  type: "preview.failed";
  sessionId: string;
  turnId: string;
  previewId: string;
  artifactId?: string;
  message: string;
  code?: string;
};

export type AssistantPreviewUpdatedMessage = {
  type: "preview.updated";
  sessionId: string;
  turnId: string;
  preview: AssistantPreviewDescriptor;
};

export type AssistantPreviewStaleMessage = {
  type: "preview.stale";
  sessionId: string;
  turnId: string;
  preview: AssistantPreviewDescriptor;
};

export type AssistantPreviewSupersededMessage = {
  type: "preview.superseded";
  sessionId: string;
  turnId: string;
  preview: AssistantPreviewDescriptor;
};

export type AssistantPreviewClosedMessage = {
  type: "preview.closed";
  sessionId: string;
  turnId: string;
  previewId: string;
};

export type AssistantWorkspaceActionMessage = {
  type: "workspace.action";
  sessionId: string;
  turnId?: string;
  action: AssistantWorkspaceAction;
};

export type AssistantWorkspaceActionResultMessage = {
  type: "workspace.action.result";
  sessionId: string;
  turnId?: string;
  actionType: AssistantWorkspaceActionType;
  success: boolean;
  changedState?: Record<string, unknown>;
  error?: AssistantErrorPayload;
};

export type AssistantVoiceStateMessage = {
  type: "voice.state";
  sessionId: string;
  state:
    | "idle"
    | "listening"
    | "transcribing"
    | "speaking"
    | "interrupted"
    | "error";
  transcriptPartial?: string;
  transcriptFinal?: string;
};

export type AssistantPresenceStateMessage = {
  type: "presence.state";
  sessionId: string;
  state:
    | "idle_present"
    | "listening_active"
    | "listening_deep"
    | "thinking_light"
    | "thinking_focused"
    | "speaking_calm"
    | "speaking_explaining"
    | "speaking_energetic"
    | "interrupted"
    | "returning_to_neutral";
};

export type AssistantSessionOutboundMessage =
  | AssistantSessionReadyMessage
  | AssistantSessionStateMessage
  | AssistantTurnStartedMessage
  | AssistantActivityMessage
  | AssistantTextDeltaMessage
  | AssistantToolCallMessage
  | AssistantToolProgressMessage
  | AssistantToolResultMessage
  | AssistantTurnCompletedMessage
  | AssistantTurnCancelledMessage
  | AssistantErrorMessage
  | AssistantSessionClosedMessage
  | AssistantPreviewCreatedMessage
  | AssistantPreviewPartialMessage
  | AssistantPreviewReadyMessage
  | AssistantPreviewFailedMessage
  | AssistantPreviewUpdatedMessage
  | AssistantPreviewStaleMessage
  | AssistantPreviewSupersededMessage
  | AssistantPreviewClosedMessage
  | AssistantWorkspaceActionMessage
  | AssistantWorkspaceActionResultMessage
  | AssistantVoiceStateMessage
  | AssistantPresenceStateMessage;

export function isAssistantSessionInboundMessage(value: unknown): value is AssistantSessionInboundMessage {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "session.start" ||
    type === "session.turn" ||
    type === "session.cancel" ||
    type === "session.close"
  );
}

export function isAssistantSessionOutboundMessage(value: unknown): value is AssistantSessionOutboundMessage {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && type.length > 0;
}

export function isAssistantTurnTerminalMessage(
  message: AssistantSessionOutboundMessage,
): message is AssistantTurnCompletedMessage | AssistantTurnCancelledMessage | AssistantErrorMessage {
  return (
    message.type === "turn.completed" ||
    message.type === "turn.cancelled" ||
    message.type === "error"
  );
}

export function isAssistantPreviewTerminalStatus(status: AssistantPreviewStatus): boolean {
  return status === "ready" || status === "failed" || status === "closed";
}

export function createProtocolVersionMismatchError(
  sessionId: string,
  version: string,
): AssistantErrorMessage {
  return {
    type: "error",
    sessionId,
    scope: "transport",
    message: `Unsupported protocol version ${version}`,
    code: "UNSUPPORTED_PROTOCOL_VERSION",
  };
}
