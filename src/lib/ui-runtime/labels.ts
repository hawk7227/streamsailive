import type { UIState } from "./types";

export const UI_STATE_LABELS: Record<UIState, string | null> = {
  idle: null,
  working: "Working…",
  thinking: "Thinking…",
  processing_files: "Looking through your files…",
  executing_tool: null,
  streaming: null,
  completed: null,
  error: "Something went wrong",
};
