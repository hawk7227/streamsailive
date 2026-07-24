export type ProductIntent =
  | "GENERAL_CHAT"
  | "CREATE_WEBSITE"
  | "EDIT_WEBSITE"
  | "OPEN_PREVIEW"
  | "OPEN_WORKSPACE"
  | "EXPLAIN_FAILURE"
  | "RETRY_LAST_OPERATION"
  | "CANCEL_OPERATION";

export type OperationStage =
  | "RECEIVED"
  | "REQUIREMENTS_RESOLVED"
  | "PROJECT_CREATED"
  | "FILES_GENERATING"
  | "FILES_WRITTEN"
  | "BUILDING"
  | "BUILD_VALIDATING"
  | "PREVIEW_STARTING"
  | "PREVIEW_READY"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type OperationStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type RuntimeArtifact = {
  artifactId: string;
  artifactType: "project" | "source" | "build" | "preview" | "checkpoint";
  status: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
};

export type OperationFailure = {
  code: string;
  stage: OperationStage;
  safeMessage: string;
  retryable: boolean;
  detail?: string;
};

export type RuntimeOperation = {
  operationId: string;
  sessionId: string;
  turnId: string;
  intent: ProductIntent;
  stage: OperationStage;
  status: OperationStatus;
  idempotencyKey: string;
  parentOperationId?: string | null;
  projectId?: string | null;
  previewId?: string | null;
  previewUrl?: string | null;
  artifacts: RuntimeArtifact[];
  failure?: OperationFailure | null;
  metadata?: Record<string, unknown>;
};

export type RouteDecision = {
  intent: ProductIntent;
  confidence: number;
  deterministic: boolean;
  requiresBuilder: boolean;
  requiresCurrentInformation: boolean;
  requestedOutput: "CHAT_ONLY" | "PREVIEW_ONLY" | "CODE_AND_PREVIEW" | "CODE_ONLY";
  referent: "last_operation" | "active_preview" | "active_workspace" | null;
  signals: string[];
};
