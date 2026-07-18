export type WorkspacePanel = "project" | "inspector" | "tray";
export type WorkspaceInspectorTab = "Properties" | "Content" | "Generate" | "Project Guidance" | "Ask AI";
export type WorkspaceTrayTab = "Assets" | "Outputs" | "Tasks" | "Activity" | "Versions" | "Comments" | "Console" | "Logs" | "Diff" | "Proof" | "Verification";
export type WorkspaceDurableState = "idle" | "loading" | "local" | "saving" | "saved" | "error";

export type UniversalWorkspaceState = {
  projectId: string;
  projectName: string;
  projectType: string;
  projectStatus: string;
  saveStatus: string;
  durableState: WorkspaceDurableState;
  durableRevision: number;
  durableError: string;
  currentStage: string;
  progress: number;
  nextAction: string;
  activeGlobalNav: string;
  activeInspectorTab: WorkspaceInspectorTab;
  activeTrayTab: WorkspaceTrayTab;
  projectPanelOpen: boolean;
  inspectorOpen: boolean;
  trayOpen: boolean;
  fullscreenCanvas: boolean;
};

export const DEFAULT_WORKSPACE_STATE: UniversalWorkspaceState = {
  projectId: "",
  projectName: "Streams Builder",
  projectType: "Coding / Application",
  projectStatus: "In Progress",
  saveStatus: "Restoring project state…",
  durableState: "idle",
  durableRevision: 0,
  durableError: "",
  currentStage: "Combining existing builder capabilities",
  progress: 18,
  nextAction: "Use the existing builder in the workspace canvas",
  activeGlobalNav: "Build",
  activeInspectorTab: "Properties",
  activeTrayTab: "Activity",
  projectPanelOpen: true,
  inspectorOpen: true,
  trayOpen: false,
  fullscreenCanvas: false,
};
