import { getActivityMessage } from "../status/activityMessages";
import "./generation-activity-strip.css";

export default function GenerationActivityStrip({
  mode = "chat",
  phase = "working",
  statusText,
}) {
  const message = getActivityMessage({ mode, phase, statusText });

  return (
    <div className="generationActivityStrip" role="status" aria-live="polite">
      <div className="generationActivityBg" />
      <div className="generationActivityGrid" />
      <div className="generationActivityOverlay" />

      <div className="generationActivityContent">
        <div className="generationActivityLabel">{message.label}</div>
        <div className="generationActivityTitle">{message.title}</div>
        <div className="generationActivitySub">{message.subtitle}</div>
      </div>
    </div>
  );
}
