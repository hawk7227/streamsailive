"use client";

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
