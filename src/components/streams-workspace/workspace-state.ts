export type WorkspacePanel = "project" | "inspector" | "tray";
export type WorkspaceInspectorTab = "Properties" | "Content" | "Generate" | "Project Guidance" | "Ask AI";
export type WorkspaceTrayTab = "Assets" | "Outputs" | "Tasks" | "Activity" | "Versions" | "Comments" | "Console" | "Logs" | "Diff" | "Proof" | "Verification";
export type WorkspaceDurableState = "idle" | "loading" | "local" | "saving" | "saved" | "error";

export type UniversalWorkspaceState = {
  projectId: string;
  projectName: string;
  projectType: string;
  projectStatus: string;
  projectGoal: string;
  projectAudience: string;
  projectDescription: string;
  projectInstructions: string;
  projectStyle: string;
  projectFiles: Array<Record<string, unknown>>;
  projectDecisions: string[];
  projectRequirements: string[];
  projectConstraints: string[];
  originalPrompt: string;
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
  projectGoal: "Complete the active project using the preserved Streams builder capabilities.",
  projectAudience: "Project collaborators and end users",
  projectDescription: "Universal project workspace connected to the existing StreamsAI chat and builder.",
  projectInstructions: "Preserve working systems and complete only verified gaps.",
  projectStyle: "Use the project’s approved visual and technical decisions.",
  projectFiles: [],
  projectDecisions: [],
  projectRequirements: [],
  projectConstraints: [],
  originalPrompt: "",
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
  projectPanelOpen: false,
  inspectorOpen: false,
  trayOpen: false,
  fullscreenCanvas: false,
};
