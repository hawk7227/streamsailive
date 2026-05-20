import { VIDEO_EDITOR_ACTIONS } from "../../../runtime/streamsVideoEditorActions";

export default function VideoInspectorPanel({ selectedRange, selectedActionId, onSelectAction }) {
  return (
    <aside aria-label="Video inspector">
      <h3>Inspector</h3>
      <div>Selected type: {selectedRange?.type || "none"}</div>
      <div>Selected range: {selectedRange?.startTime ?? 0}s–{selectedRange?.endTime ?? 0}s</div>

      <h3>Actions</h3>
      {VIDEO_EDITOR_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={!action.enabled}
          aria-label={action.label}
          onClick={() => onSelectAction?.(action.id)}
        >
          {action.label}
          {selectedActionId === action.id ? " · selected" : ""}
          {!action.enabled && action.blockedReason ? ` · ${action.blockedReason}` : ""}
        </button>
      ))}
    </aside>
  );
}
