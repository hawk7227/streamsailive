export type StreamsRuntimePhase =
  | "idle"
  | "thinking"
  | "reading-file"
  | "generating-image"
  | "editing-image"
  | "building"
  | "responding"
  | "complete"
  | "error";

export type StreamsWorkspaceMessageRole = "user" | "assistant" | "system" | "tool";

export type StreamsWorkspaceArtifact = {
  id: string;
  type: string;
  title?: string;
  code?: string;
  language?: string;
  preview?: boolean;
  suppressInChat?: boolean;
  storageUrl?: string;
  thumbnailUrl?: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

export type StreamsWorkspaceMessage = {
  id: string;
  role: StreamsWorkspaceMessageRole;
  content: string;
  artifactIds: string[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type StreamsWorkspaceSession = {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type StreamsRuntimeStatus = {
  phase: StreamsRuntimePhase;
  label: string;
  title: string;
  subtitle?: string;
  mode?: string;
  elapsedMs?: number;
};
