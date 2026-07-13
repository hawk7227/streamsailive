import { getActivityMessage } from "../status/activityMessages";
import "./generation-activity-strip.css";

function normalizePhase(value) {
  if (["complete", "completed", "ready", "success"].includes(value)) return "complete";
  if (["failed", "error"].includes(value)) return "failed";
  if (["waiting", "blocked"].includes(value)) return value;
  if (["streaming", "rendering", "running", "thinking", "working"].includes(value)) return "running";
  return value || "running";
}

export default function GenerationActivityStrip({
  activity,
  mode = "chat",
  phase = "working",
  statusText,
}) {
  const resolvedMode = activity?.mode || activity?.domain || mode;
  const resolvedPhase = normalizePhase(activity?.phase || phase);
  const resolvedStatusText = activity?.statusText || statusText;
  const message = getActivityMessage({
    mode: resolvedMode,
    phase: resolvedPhase,
    statusText: resolvedStatusText,
  });

  return (
    <div
      className="generationActivityStrip streamsActivityRow"
      data-domain={resolvedMode}
      data-phase={resolvedPhase}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="generationActivityBg" aria-hidden="true" />
      <div className="generationActivityGrid" aria-hidden="true" />
      <div className="generationActivityOverlay" aria-hidden="true" />

      <div className="generationActivityContent">
        <div className="generationActivityLabel">{message.label}</div>
        <div className="generationActivityTitle">{message.title}</div>
        <div className="generationActivitySub">{message.subtitle}</div>
      </div>
    </div>
  );
}
