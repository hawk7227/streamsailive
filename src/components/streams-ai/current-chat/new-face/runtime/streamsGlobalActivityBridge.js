import {
  STREAMS_ACTIVITY_DOMAINS,
  STREAMS_ACTIVITY_PHASES,
  STREAMS_ACTIVITY_SEVERITY,
} from "./streamsActivityEvents";

export const STREAMS_ACTIVITY_EVENT_NAME = "streams:activity";

export function emitStreamsActivity(input = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(STREAMS_ACTIVITY_EVENT_NAME, {
      detail: {
        action: input.action || "push",
        domain: input.domain || STREAMS_ACTIVITY_DOMAINS.TURN,
        phase: input.phase || STREAMS_ACTIVITY_PHASES.RUNNING,
        severity: input.severity || STREAMS_ACTIVITY_SEVERITY.INFO,
        statusText: input.statusText || "Working…",
        detail: input.detail || "",
        source: input.source || "global",
        tool: input.tool || null,
        jobId: input.jobId || null,
        messageId: input.messageId || null,
        metadata: input.metadata || {},
      },
    })
  );
}

export function subscribeToStreamsActivityEvents(listener) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => {
    listener(event.detail || {});
  };

  window.addEventListener(STREAMS_ACTIVITY_EVENT_NAME, handler);
  return () => window.removeEventListener(STREAMS_ACTIVITY_EVENT_NAME, handler);
}

function severityForPhase(phase) {
  if (phase === STREAMS_ACTIVITY_PHASES.FAILED) return STREAMS_ACTIVITY_SEVERITY.ERROR;
  if (phase === STREAMS_ACTIVITY_PHASES.BLOCKED) return STREAMS_ACTIVITY_SEVERITY.WARNING;
  if (phase === STREAMS_ACTIVITY_PHASES.COMPLETE) return STREAMS_ACTIVITY_SEVERITY.SUCCESS;
  return STREAMS_ACTIVITY_SEVERITY.INFO;
}

function actionForPhase(phase) {
  if (phase === STREAMS_ACTIVITY_PHASES.COMPLETE) return "complete";
  if (phase === STREAMS_ACTIVITY_PHASES.FAILED) return "fail";
  return "push";
}

export function emitTurnActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.TURN,
    phase,
    severity: severityForPhase(phase),
    statusText,
    metadata,
    source: "turn",
  });
}

export function emitToolActivity(tool, phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.TOOL,
    phase,
    severity: severityForPhase(phase),
    tool,
    statusText,
    metadata,
    source: "tool",
  });
}

export function emitVoiceActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.VOICE,
    phase,
    severity: severityForPhase(phase),
    tool: "realtime_voice",
    statusText,
    metadata,
    source: "voice",
  });
}

export function emitFileActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.FILES,
    phase,
    severity: severityForPhase(phase),
    tool: "files",
    statusText,
    metadata,
    source: "files",
  });
}

export function emitImageActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.IMAGE,
    phase,
    severity: severityForPhase(phase),
    tool: "image",
    statusText,
    metadata,
    source: "image",
  });
}

export function emitVideoActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.VIDEO,
    phase,
    severity: severityForPhase(phase),
    tool: "video",
    statusText,
    metadata,
    source: "video",
  });
}

export function emitAccountActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.ACCOUNT,
    phase,
    severity: severityForPhase(phase),
    tool: "account",
    statusText,
    metadata,
    source: "account",
  });
}

export function emitBillingActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.BILLING,
    phase,
    severity: severityForPhase(phase),
    tool: "billing",
    statusText,
    metadata,
    source: "billing",
  });
}

export function emitCreditsActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.CREDITS,
    phase,
    severity: severityForPhase(phase),
    tool: "credits",
    statusText,
    metadata,
    source: "credits",
  });
}

export function emitProjectActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.PROJECT,
    phase,
    severity: severityForPhase(phase),
    tool: "project",
    statusText,
    metadata,
    source: "project",
  });
}

export function emitGitHubActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.GITHUB,
    phase,
    severity: severityForPhase(phase),
    tool: "github",
    statusText,
    metadata,
    source: "github",
  });
}

export function emitChatActionActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.CHAT_ACTION,
    phase,
    severity: severityForPhase(phase),
    tool: metadata.tool || "chat_action",
    statusText,
    metadata,
    source: "chat_action",
  });
}

export function emitGroupChatActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.CHAT_ACTION,
    phase,
    severity: severityForPhase(phase),
    tool: "group_chat",
    statusText,
    metadata,
    source: "group_chat",
  });
}

export function emitNetworkActivity(phase, statusText, metadata = {}) {
  emitStreamsActivity({
    action: actionForPhase(phase),
    domain: STREAMS_ACTIVITY_DOMAINS.NETWORK,
    phase,
    severity: severityForPhase(phase),
    tool: "network",
    statusText,
    metadata,
    source: "network",
  });
}
