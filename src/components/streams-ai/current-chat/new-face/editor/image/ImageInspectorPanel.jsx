import { IMAGE_EDITOR_ACTIONS } from "../../../runtime/streamsImageEditorActions";

export default function ImageInspectorPanel({ selectedLayerId, selectedActionId, onSelectAction }) {
  return (
    <aside aria-label="Image inspector">
      <h3>Inspector</h3>
      <div>Selected layer: {selectedLayerId || "None"}</div>

      <h3>Actions</h3>
      {IMAGE_EDITOR_ACTIONS.map((action) => (
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
