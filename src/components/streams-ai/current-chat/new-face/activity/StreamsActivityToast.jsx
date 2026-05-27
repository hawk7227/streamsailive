"use client";

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
