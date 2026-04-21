import { UI_STATE_LABELS } from "./labels";
import { getModeFallbackLabel } from "./modeLabels";
import { getToolLabel } from "./toolLabels";
import type { RealtimeEvent, UserFacingUIState } from "./types";

export function translateSystemEventToUIState(
  event: RealtimeEvent,
): UserFacingUIState {
  switch (event.type) {
    case "turn.started":
      return {
        state: "working",
        label: UI_STATE_LABELS.working,
      };

    case "session.state":
      if (event.status === "failed") {
        return {
          state: "error",
          label: UI_STATE_LABELS.error,
        };
      }

      if (event.status === "completed") {
        return {
          state: "completed",
          label: UI_STATE_LABELS.completed,
        };
      }

      if (event.status === "running") {
        return {
          state: "working",
          label: UI_STATE_LABELS.working,
        };
      }

      return {
        state: "idle",
        label: UI_STATE_LABELS.idle,
      };

    case "activity":
      switch (event.stage) {
        case "understanding":
        case "routing":
        case "calling_openai":
          return {
            state: "thinking",
            label: getModeFallbackLabel(event.mode),
          };

        case "building_context":
          return {
            state: "processing_files",
            label: UI_STATE_LABELS.processing_files,
          };

        case "executing_tool":
          return {
            state: "executing_tool",
            label: event.tool
              ? getToolLabel(event.tool)
              : getModeFallbackLabel(event.mode),
          };

        case "streaming":
          return {
            state: "streaming",
            label: null,
          };

        default:
          return {
            state: "thinking",
            label: UI_STATE_LABELS.thinking,
          };
      }

    case "text.delta":
      return {
        state: "streaming",
        label: null,
      };

    case "response.completed":
      return {
        state: "completed",
        label: null,
      };

    case "response.failed":
      return {
        state: "error",
        label: UI_STATE_LABELS.error,
      };

    default:
      return {
        state: "idle",
        label: UI_STATE_LABELS.idle,
      };
  }
}
