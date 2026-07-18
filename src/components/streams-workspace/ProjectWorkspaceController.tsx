"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { emitWorkspaceEvent, WORKSPACE_EVENT_NAMES } from "./workspace-events";
import {
  DEFAULT_WORKSPACE_STATE,
  type UniversalWorkspaceState,
  type WorkspaceInspectorTab,
  type WorkspaceTrayTab,
} from "./workspace-state";

type WorkspaceContextValue = {
  state: UniversalWorkspaceState;
  setState: Dispatch<SetStateAction<UniversalWorkspaceState>>;
  setGlobalNav: (item: string) => void;
  setInspectorTab: (tab: WorkspaceInspectorTab) => void;
  setTrayTab: (tab: WorkspaceTrayTab) => void;
  toggleProjectPanel: () => void;
  toggleInspector: () => void;
  toggleTray: () => void;
  toggleFullscreenCanvas: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function ProjectWorkspaceController({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UniversalWorkspaceState>(DEFAULT_WORKSPACE_STATE);

  const update = useCallback((next: Partial<UniversalWorkspaceState>, eventName = WORKSPACE_EVENT_NAMES.stateChanged) => {
    setState((current) => {
      const updated = { ...current, ...next };
      emitWorkspaceEvent(eventName, updated);
      return updated;
    });
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    state,
    setState,
    setGlobalNav: (item) => update({ activeGlobalNav: item }, WORKSPACE_EVENT_NAMES.navigationChanged),
    setInspectorTab: (tab) => update({ activeInspectorTab: tab, inspectorOpen: true }, WORKSPACE_EVENT_NAMES.inspectorChanged),
    setTrayTab: (tab) => update({ activeTrayTab: tab, trayOpen: true }, WORKSPACE_EVENT_NAMES.trayChanged),
    toggleProjectPanel: () => update({ projectPanelOpen: !state.projectPanelOpen }, WORKSPACE_EVENT_NAMES.panelChanged),
    toggleInspector: () => update({ inspectorOpen: !state.inspectorOpen }, WORKSPACE_EVENT_NAMES.panelChanged),
    toggleTray: () => update({ trayOpen: !state.trayOpen }, WORKSPACE_EVENT_NAMES.panelChanged),
    toggleFullscreenCanvas: () => update({ fullscreenCanvas: !state.fullscreenCanvas }, WORKSPACE_EVENT_NAMES.panelChanged),
  }), [state, update]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useProjectWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useProjectWorkspace must be used within ProjectWorkspaceController");
  return value;
}
