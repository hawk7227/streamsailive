export type StreamsBuilderTruthState = "PROVEN" | "FAILED" | "UNPROVEN" | "UNKNOWN" | "WAITING_FOR_USER";

export type StreamsBuilderStage =
  | "conversation"
  | "requirements"
  | "architecture"
  | "blueprint"
  | "repository_pending"
  | "execution_pending"
  | "preview_pending"
  | "proof_pending"
  | "approval_pending";

export type StreamsBuilderWorkspace =
  | "primary"
  | "visual_editing"
  | "component_mapping"
  | "approval_center"
  | "browser_verification"
  | "repository_truth"
  | "projects_dashboard";

export interface StreamsBuilderBridgePayload {
  projectId?: string;
  conversationId?: string;
  projectName?: string;
  userIntent?: string;
  buildMode?: "new_project" | "existing_repository" | "unknown";
  requirements?: string;
  architecture?: string;
  blueprint?: string;
  repo?: string;
  route?: string;
  component?: string;
  file?: string;
  githubPath?: string;
  previewUrl?: string;
}

export interface StreamsProjectContainer {
  projectId: string;
  name: string;
  description: string;
  repo: string | null;
  branch: string | null;
  memoryScope: string;
  assetScope: string;
  checkpointScope: string;
  proofScope: string;
  deploymentScope: string;
  notificationScope: string;
  status: StreamsBuilderStage;
  truthState: StreamsBuilderTruthState;
  createdFromConversationId: string | null;
}

export interface StreamsBuilderSession {
  sessionId: string;
  activeProjectId: string;
  activeRoute: string | null;
  activeComponent: string | null;
  activeFile: string | null;
  activeWorkspace: StreamsBuilderWorkspace;
  activeBuildJob: string | null;
  activeCheckpoint: string | null;
  activeProofStatus: StreamsBuilderTruthState;
  activePreviewUrl: string | null;
}

export interface StreamsSourceTruthRecord {
  route: string | null;
  previewUrl: string | null;
  component: string | null;
  file: string | null;
  githubPath: string | null;
  buildJob: string | null;
  checkpoint: string | null;
  proofStatus: StreamsBuilderTruthState;
  truthState: StreamsBuilderTruthState;
}

export interface StreamsBuilderLoopState {
  id: string;
  label: string;
  stage: StreamsBuilderStage;
  truthState: StreamsBuilderTruthState;
  currentStep: string;
  evidence: string[];
  stopCondition: string;
}

export interface StreamsBuilderBridgeState {
  project: StreamsProjectContainer;
  session: StreamsBuilderSession;
  sourceTruth: StreamsSourceTruthRecord;
  loops: StreamsBuilderLoopState[];
  transferredContext: {
    requirements: string;
    architecture: string;
    blueprint: string;
    userIntent: string;
    buildMode: StreamsBuilderBridgePayload["buildMode"];
  };
}
