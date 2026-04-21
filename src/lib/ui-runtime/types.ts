export type SystemEventType =
  | "turn.started"
  | "session.state"
  | "activity"
  | "text.delta"
  | "response.completed"
  | "response.failed";

export type SessionStatus = "idle" | "running" | "completed" | "failed";

export type ActivityStage =
  | "understanding"
  | "routing"
  | "building_context"
  | "calling_openai"
  | "streaming"
  | "executing_tool";

export type RuntimeMode =
  | "conversation"
  | "build"
  | "image"
  | "video"
  | "audio"
  | "files"
  | "document"
  | "search";

export type ToolType = RuntimeMode;

export type UIState =
  | "idle"
  | "working"
  | "thinking"
  | "processing_files"
  | "executing_tool"
  | "streaming"
  | "completed"
  | "error";

export interface BaseRealtimeEvent {
  type: SystemEventType;
  turnId: string;
  timestamp?: number;
}

export interface TurnStartedEvent extends BaseRealtimeEvent {
  type: "turn.started";
}

export interface SessionStateEvent extends BaseRealtimeEvent {
  type: "session.state";
  status: SessionStatus;
}

export interface ActivityEvent extends BaseRealtimeEvent {
  type: "activity";
  stage: ActivityStage;
  mode?: RuntimeMode;
  tool?: ToolType;
}

export interface TextDeltaEvent extends BaseRealtimeEvent {
  type: "text.delta";
  delta: string;
}

export interface ResponseCompletedEvent extends BaseRealtimeEvent {
  type: "response.completed";
}

export interface ResponseFailedEvent extends BaseRealtimeEvent {
  type: "response.failed";
  error: string;
}

export type RealtimeEvent =
  | TurnStartedEvent
  | SessionStateEvent
  | ActivityEvent
  | TextDeltaEvent
  | ResponseCompletedEvent
  | ResponseFailedEvent;

export interface UserFacingUIState {
  state: UIState;
  label: string | null;
}

export interface TurnUIState extends UserFacingUIState {
  turnId: string;
  updatedAt: number;
}
