export const WORKSPACE_EVENT_NAMES = {
  stateChanged: "streams-workspace:state-changed",
  panelChanged: "streams-workspace:panel-changed",
  navigationChanged: "streams-workspace:navigation-changed",
  inspectorChanged: "streams-workspace:inspector-changed",
  trayChanged: "streams-workspace:tray-changed",
} as const;

export type WorkspaceEventName = (typeof WORKSPACE_EVENT_NAMES)[keyof typeof WORKSPACE_EVENT_NAMES];

export function emitWorkspaceEvent<T>(name: WorkspaceEventName, detail: T) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
