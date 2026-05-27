from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

write("src/components/streams-ai/current-chat/new-face/runtime/streamsActivityEvents.js", '''export const STREAMS_ACTIVITY_DOMAINS = Object.freeze({
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
''')

write("src/components/streams-ai/current-chat/new-face/runtime/streamsActivityBus.js", '''import {
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
''')

write("src/components/streams-ai/current-chat/new-face/activity/useStreamsLiveActivity.js", '''"use client";

import { useMemo, useState } from "react";
import {
  createInitialActivityState,
  pushStreamsActivity,
  updateStreamsActivity,
  completeStreamsActivity,
  failStreamsActivity,
  clearStreamsActivity,
} from "../runtime/streamsActivityBus";

export function useStreamsLiveActivity(initialState) {
  const [activityState, setActivityState] = useState(() => initialState || createInitialActivityState());

  const actions = useMemo(() => ({
    push(input) {
      setActivityState((state) => pushStreamsActivity(state, input));
    },

    update(patch) {
      setActivityState((state) => updateStreamsActivity(state, patch));
    },

    complete(patch) {
      setActivityState((state) => completeStreamsActivity(state, patch));
    },

    fail(patch) {
      setActivityState((state) => failStreamsActivity(state, patch));
    },

    clear() {
      setActivityState((state) => clearStreamsActivity(state));
    },
  }), []);

  return {
    activityState,
    activeActivity: activityState.active,
    activityEvents: activityState.events,
    lastCompletedActivity: activityState.lastCompleted,
    lastFailedActivity: activityState.lastFailed,
    activityActions: actions,
  };
}
''')

write("src/components/streams-ai/current-chat/new-face/activity/StreamsActivityToast.jsx", '''"use client";

import "./streams-activity.css";

function formatDetail(activity) {
  if (!activity?.detail) return "";
  return String(activity.detail);
}

export default function StreamsActivityToast({ activity, onOpenTimeline }) {
  if (!activity) return null;

  return (
    <div className={`streamsActivityToast is-${activity.severity || "info"}`} role="status" aria-live="polite">
      <div className="streamsActivityPulse" />
      <div className="streamsActivityToastText">
        <strong>{activity.statusText || "Working…"}</strong>
        {formatDetail(activity) ? <span>{formatDetail(activity)}</span> : null}
      </div>
      {typeof onOpenTimeline === "function" ? (
        <button type="button" onClick={onOpenTimeline}>
          Activity
        </button>
      ) : null}
    </div>
  );
}
''')

write("src/components/streams-ai/current-chat/new-face/activity/StreamsActivityTimeline.jsx", '''"use client";

import "./streams-activity.css";

function phaseLabel(phase = "") {
  return String(phase).replace(/_/g, " ");
}

export default function StreamsActivityTimeline({ open, events = [], onClose }) {
  if (!open) return null;

  return (
    <div className="streamsActivityTimelineBackdrop" role="presentation" onClick={onClose}>
      <aside
        className="streamsActivityTimeline"
        role="dialog"
        aria-modal="true"
        aria-label="Live activity"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <strong>Live activity</strong>
            <span>Real runtime, tool, job, and browser events</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close activity timeline">×</button>
        </header>

        {events.length ? (
          <ol>
            {events.map((event) => (
              <li key={event.id} className={`is-${event.severity || "info"}`}>
                <div className="streamsActivityDot" />
                <div>
                  <strong>{event.statusText || "Working…"}</strong>
                  <span>
                    {event.domain} · {phaseLabel(event.phase)}
                    {event.tool ? ` · ${event.tool}` : ""}
                  </span>
                  {event.detail ? <p>{event.detail}</p> : null}
                </div>
                <time>{new Date(event.updatedAt || event.startedAt).toLocaleTimeString()}</time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="streamsActivityEmpty">No activity yet.</div>
        )}
      </aside>
    </div>
  );
}
''')

write("src/components/streams-ai/current-chat/new-face/activity/streams-activity.css", '''.streamsActivityToast {
  position: fixed;
  left: 50%;
  bottom: calc(92px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 1900;
  min-height: 44px;
  max-width: min(520px, calc(100vw - 28px));
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 999px;
  background: rgba(255,255,255,.96);
  box-shadow: 0 18px 60px rgba(0,0,0,.18);
  padding: 8px 10px 8px 14px;
  color: #111;
  backdrop-filter: blur(18px);
}

.streamsActivityToast.is-error {
  border-color: rgba(220,38,38,.18);
  background: rgba(255,241,241,.98);
}

.streamsActivityToast.is-warning {
  border-color: rgba(217,119,6,.22);
  background: rgba(255,248,237,.98);
}

.streamsActivityToast.is-success {
  border-color: rgba(22,163,74,.2);
  background: rgba(240,253,244,.98);
}

.streamsActivityPulse {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  opacity: .8;
  animation: streamsActivityPulse 1.2s ease-in-out infinite;
}

.streamsActivityToastText {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.streamsActivityToastText strong {
  font-size: 13px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.streamsActivityToastText span {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.streamsActivityToast button {
  min-height: 32px;
  border: 0;
  border-radius: 999px;
  padding: 0 12px;
  background: #111;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 760;
}

.streamsActivityTimelineBackdrop {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  justify-content: flex-end;
  background: rgba(0,0,0,.18);
}

.streamsActivityTimeline {
  width: min(420px, 100vw);
  height: 100dvh;
  background: #fff;
  border-left: 1px solid rgba(0,0,0,.08);
  box-shadow: -24px 0 70px rgba(0,0,0,.16);
  display: flex;
  flex-direction: column;
  color: #111;
}

.streamsActivityTimeline header {
  min-height: 72px;
  padding: 16px;
  border-bottom: 1px solid rgba(0,0,0,.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.streamsActivityTimeline header div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.streamsActivityTimeline header strong {
  font-size: 18px;
  letter-spacing: -.02em;
}

.streamsActivityTimeline header span {
  font-size: 12px;
  color: #666;
}

.streamsActivityTimeline header button {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 999px;
  background: #f4f4f5;
  font-size: 22px;
  cursor: pointer;
}

.streamsActivityTimeline ol {
  list-style: none;
  margin: 0;
  padding: 12px;
  overflow: auto;
  display: grid;
  gap: 8px;
}

.streamsActivityTimeline li {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  gap: 10px;
  border: 1px solid rgba(0,0,0,.07);
  border-radius: 16px;
  padding: 10px;
  background: #fafafa;
}

.streamsActivityTimeline li.is-error {
  background: #fff1f1;
  border-color: rgba(220,38,38,.16);
}

.streamsActivityTimeline li.is-warning {
  background: #fff8ed;
  border-color: rgba(217,119,6,.18);
}

.streamsActivityTimeline li.is-success {
  background: #f0fdf4;
  border-color: rgba(22,163,74,.18);
}

.streamsActivityDot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: currentColor;
  margin-top: 5px;
}

.streamsActivityTimeline li div:nth-child(2) {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.streamsActivityTimeline li strong {
  font-size: 13px;
}

.streamsActivityTimeline li span,
.streamsActivityTimeline li time,
.streamsActivityTimeline li p {
  font-size: 11px;
  color: #666;
}

.streamsActivityTimeline li p {
  margin: 4px 0 0;
  line-height: 1.35;
}

.streamsActivityEmpty {
  margin: 16px;
  border-radius: 18px;
  background: #f6f6f7;
  color: #666;
  padding: 16px;
  font-size: 13px;
}

@keyframes streamsActivityPulse {
  0%, 100% { transform: scale(1); opacity: .55; }
  50% { transform: scale(1.35); opacity: 1; }
}

@media (max-width: 760px) {
  .streamsActivityToast {
    bottom: calc(76px + env(safe-area-inset-bottom, 0px));
    width: calc(100vw - 20px);
    max-width: none;
  }

  .streamsActivityTimeline {
    width: 100vw;
  }
}
''')

runtime_path = "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js"
s = read(runtime_path)

if 'import { useStreamsLiveActivity } from "../activity/useStreamsLiveActivity";' not in s:
    s = s.replace(
        'import { usePathname } from "next/navigation";',
        'import { usePathname } from "next/navigation";\\nimport { useStreamsLiveActivity } from "../activity/useStreamsLiveActivity";'
    )

if 'STREAMS_ACTIVITY_DOMAINS' not in s:
    s = s.replace(
        'import { detectPreCallRoute } from "../../runtime/streamsPreCallRouter";',
        'import { detectPreCallRoute } from "../../runtime/streamsPreCallRouter";\\nimport { STREAMS_ACTIVITY_DOMAINS, STREAMS_ACTIVITY_PHASES, STREAMS_ACTIVITY_SEVERITY } from "../runtime/streamsActivityEvents";'
    )

if 'const { activityState, activeActivity, activityEvents, activityActions } = useStreamsLiveActivity();' not in s:
    s = s.replace(
        'export function useStreamsChatRuntime() {\\n',
        'export function useStreamsChatRuntime() {\\n  const { activityState, activeActivity, activityEvents, activityActions } = useStreamsLiveActivity();\\n'
    )

if 'activityActions.push({\\n        domain: STREAMS_ACTIVITY_DOMAINS.WEB_SEARCH,' not in s:
    s = s.replace(
        '''      const searchingStatus = resolveStreamsStatus("webSearch", "requested");
      setActivity(createActivity("thinking", "tool", searchingStatus));''',
        '''      const searchingStatus = resolveStreamsStatus("webSearch", "requested");
      activityActions.push({
        domain: STREAMS_ACTIVITY_DOMAINS.WEB_SEARCH,
        phase: STREAMS_ACTIVITY_PHASES.RUNNING,
        severity: STREAMS_ACTIVITY_SEVERITY.INFO,
        tool: "web_search",
        messageId: assistantId,
        statusText: searchingStatus,
        detail: query,
        source: "useStreamsChatRuntime",
      });
      setActivity(createActivity("thinking", "tool", searchingStatus));'''
    )

if 'activityActions.complete({\\n          domain: STREAMS_ACTIVITY_DOMAINS.WEB_SEARCH,' not in s:
    s = s.replace(
        '''        setActivity(createActivity("complete", "tool", resolveStreamsStatus("webSearch", "complete")));''',
        '''        activityActions.complete({
          domain: STREAMS_ACTIVITY_DOMAINS.WEB_SEARCH,
          phase: STREAMS_ACTIVITY_PHASES.COMPLETE,
          severity: STREAMS_ACTIVITY_SEVERITY.SUCCESS,
          tool: "web_search",
          messageId: assistantId,
          statusText: resolveStreamsStatus("webSearch", "complete"),
          detail: query,
          source: "useStreamsChatRuntime",
        });
        setActivity(createActivity("complete", "tool", resolveStreamsStatus("webSearch", "complete")));''',
        1
    )

if 'activityActions.fail({\\n          domain: STREAMS_ACTIVITY_DOMAINS.WEB_SEARCH,' not in s:
    s = s.replace(
        '''        setActivity(createActivity("error", "tool", resolveStreamsStatus("webSearch", "failed", errorText)));''',
        '''        activityActions.fail({
          domain: STREAMS_ACTIVITY_DOMAINS.WEB_SEARCH,
          phase: STREAMS_ACTIVITY_PHASES.FAILED,
          severity: STREAMS_ACTIVITY_SEVERITY.ERROR,
          tool: "web_search",
          messageId: assistantId,
          statusText: resolveStreamsStatus("webSearch", "failed", errorText),
          detail: query,
          source: "useStreamsChatRuntime",
        });
        setActivity(createActivity("error", "tool", resolveStreamsStatus("webSearch", "failed", errorText)));''',
        1
    )

if '    activityState,\\n    activeActivity,\\n    activityEvents,\\n    activityActions,\\n' not in s:
    s = s.replace(
        '    activity,\\n',
        '    activity,\\n    activityState,\\n    activeActivity,\\n    activityEvents,\\n    activityActions,\\n',
        1
    )

write(runtime_path, s)

shell_path = "src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx"
s = read(shell_path)

if 'StreamsActivityToast' not in s:
    s = s.replace(
        'import StreamsComposer from "./composer/StreamsComposer";',
        'import StreamsComposer from "./composer/StreamsComposer";\\nimport StreamsActivityToast from "./activity/StreamsActivityToast";\\nimport StreamsActivityTimeline from "./activity/StreamsActivityTimeline";'
    )

if 'const [activityTimelineOpen, setActivityTimelineOpen] = useState(false);' not in s:
    s = s.replace(
        '  const [shareOpen, setShareOpen] = useState(false);',
        '  const [shareOpen, setShareOpen] = useState(false);\\n  const [activityTimelineOpen, setActivityTimelineOpen] = useState(false);'
    )

if '<StreamsActivityToast' not in s:
    anchor = '''      <SharePopover open={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} />
'''
    injection = '''      <StreamsActivityToast
        activity={chatRuntime?.activeActivity}
        onOpenTimeline={() => setActivityTimelineOpen(true)}
      />
      <StreamsActivityTimeline
        open={activityTimelineOpen}
        events={chatRuntime?.activityEvents || []}
        onClose={() => setActivityTimelineOpen(false)}
      />
'''
    if anchor in s:
        s = s.replace(anchor, anchor + injection, 1)
    else:
        s = s.replace(
            '    </div>\\n  );\\n}',
            '      <StreamsActivityToast activity={chatRuntime?.activeActivity} onOpenTimeline={() => setActivityTimelineOpen(true)} />\\n      <StreamsActivityTimeline open={activityTimelineOpen} events={chatRuntime?.activityEvents || []} onClose={() => setActivityTimelineOpen(false)} />\\n    </div>\\n  );\\n}',
            1
        )

write(shell_path, s)

print("SUCCESS: actual unified live activity layer added and wired to web search.")
