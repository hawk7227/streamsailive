import {
  createStreamsActivityEvent,
  completeStreamsActivityEvent,
  failStreamsActivityEvent,
  isTerminalActivityPhase,
  STREAMS_ACTIVITY_PHASES,
  STREAMS_ACTIVITY_SEVERITY,
} from "./streamsActivityEvents";

export const STREAMS_ACTIVITY_LIMIT = 80;

export function createInitialActivityState() {
  return {
    active: null,
    events: [],
    lastCompleted: null,
    lastFailed: null,
  };
}

export function pushStreamsActivity(state, input) {
  const event = createStreamsActivityEvent(input);
  const events = [event, ...(state?.events || [])].slice(0, STREAMS_ACTIVITY_LIMIT);

  return {
    active: isTerminalActivityPhase(event.phase) ? null : event,
    events,
    lastCompleted: event.phase === STREAMS_ACTIVITY_PHASES.COMPLETE ? event : state?.lastCompleted || null,
    lastFailed: event.phase === STREAMS_ACTIVITY_PHASES.FAILED ? event : state?.lastFailed || null,
  };
}

export function updateStreamsActivity(state, patch = {}) {
  const active = state?.active;

  if (!active) {
    return pushStreamsActivity(state || createInitialActivityState(), patch);
  }

  const updated = {
    ...active,
    ...patch,
    metadata: {
      ...(active.metadata || {}),
      ...(patch.metadata || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  const events = [updated, ...(state?.events || []).filter((event) => event.id !== active.id)].slice(0, STREAMS_ACTIVITY_LIMIT);

  return {
    active: isTerminalActivityPhase(updated.phase) ? null : updated,
    events,
    lastCompleted: updated.phase === STREAMS_ACTIVITY_PHASES.COMPLETE ? updated : state?.lastCompleted || null,
    lastFailed: updated.phase === STREAMS_ACTIVITY_PHASES.FAILED ? updated : state?.lastFailed || null,
  };
}

export function completeStreamsActivity(state, patch = {}) {
  const active = state?.active || createStreamsActivityEvent(patch);
  const completed = completeStreamsActivityEvent(active, patch);
  const events = [completed, ...(state?.events || []).filter((event) => event.id !== active.id)].slice(0, STREAMS_ACTIVITY_LIMIT);

  return {
    active: null,
    events,
    lastCompleted: completed,
    lastFailed: state?.lastFailed || null,
  };
}

export function failStreamsActivity(state, patch = {}) {
  const active = state?.active || createStreamsActivityEvent(patch);
  const failed = failStreamsActivityEvent(active, patch);
  const events = [failed, ...(state?.events || []).filter((event) => event.id !== active.id)].slice(0, STREAMS_ACTIVITY_LIMIT);

  return {
    active: null,
    events,
    lastCompleted: state?.lastCompleted || null,
    lastFailed: failed,
  };
}

export function clearStreamsActivity(state) {
  return {
    active: null,
    events: state?.events || [],
    lastCompleted: state?.lastCompleted || null,
    lastFailed: state?.lastFailed || null,
  };
}

export function activitySeverityForPhase(phase) {
  if (phase === STREAMS_ACTIVITY_PHASES.COMPLETE) return STREAMS_ACTIVITY_SEVERITY.SUCCESS;
  if (phase === STREAMS_ACTIVITY_PHASES.FAILED) return STREAMS_ACTIVITY_SEVERITY.ERROR;
  if (phase === STREAMS_ACTIVITY_PHASES.BLOCKED) return STREAMS_ACTIVITY_SEVERITY.WARNING;
  return STREAMS_ACTIVITY_SEVERITY.INFO;
}
