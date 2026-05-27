export const STREAMS_ACTIVITY_DOMAINS = Object.freeze({
  TURN: "turn",
  MODEL: "model",
  TOOL: "tool",
  WEB_SEARCH: "web_search",
  FILES: "files",
  IMAGE: "image",
  VIDEO: "video",
  VOICE: "voice",
  JOB: "job",
  GITHUB: "github",
  ACCOUNT: "account",
  BILLING: "billing",
  CREDITS: "credits",
  PROJECT: "project",
  LIBRARY: "library",
  CHAT_ACTION: "chat_action",
  MOBILE: "mobile",
  NETWORK: "network",
  ERROR: "error",
});

export const STREAMS_ACTIVITY_PHASES = Object.freeze({
  IDLE: "idle",
  REQUESTED: "requested",
  STARTED: "started",
  ROUTING: "routing",
  LOADING: "loading",
  RUNNING: "running",
  STREAMING: "streaming",
  WAITING: "waiting",
  SAVING: "saving",
  COMPLETE: "complete",
  FAILED: "failed",
  CANCELLED: "cancelled",
  BLOCKED: "blocked",
});

export const STREAMS_ACTIVITY_SEVERITY = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

export function createStreamsActivityEvent({
  id,
  turnId,
  messageId,
  jobId,
  tool,
  domain = STREAMS_ACTIVITY_DOMAINS.TURN,
  phase = STREAMS_ACTIVITY_PHASES.RUNNING,
  statusText = "Working…",
  detail = "",
  severity = STREAMS_ACTIVITY_SEVERITY.INFO,
  source = "runtime",
  metadata = {},
  startedAt,
  completedAt,
}) {
  const now = new Date().toISOString();

  return {
    id: id || `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    turnId: turnId || null,
    messageId: messageId || null,
    jobId: jobId || null,
    tool: tool || null,
    domain,
    phase,
    statusText,
    detail,
    severity,
    source,
    metadata,
    startedAt: startedAt || now,
    updatedAt: now,
    completedAt: completedAt || null,
  };
}

export function completeStreamsActivityEvent(event, patch = {}) {
  return {
    ...event,
    ...patch,
    phase: patch.phase || STREAMS_ACTIVITY_PHASES.COMPLETE,
    severity: patch.severity || STREAMS_ACTIVITY_SEVERITY.SUCCESS,
    updatedAt: new Date().toISOString(),
    completedAt: patch.completedAt || new Date().toISOString(),
  };
}

export function failStreamsActivityEvent(event, patch = {}) {
  return {
    ...event,
    ...patch,
    phase: patch.phase || STREAMS_ACTIVITY_PHASES.FAILED,
    severity: STREAMS_ACTIVITY_SEVERITY.ERROR,
    updatedAt: new Date().toISOString(),
    completedAt: patch.completedAt || new Date().toISOString(),
  };
}

export function isTerminalActivityPhase(phase) {
  return [
    STREAMS_ACTIVITY_PHASES.COMPLETE,
    STREAMS_ACTIVITY_PHASES.FAILED,
    STREAMS_ACTIVITY_PHASES.CANCELLED,
    STREAMS_ACTIVITY_PHASES.BLOCKED,
  ].includes(phase);
}
