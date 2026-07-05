import type { StreamsAIScope } from "../auth";

export type StreamsAIRepositoryContext = {
  scope: StreamsAIScope;
};

export type CreateSessionInput = {
  title?: string;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateSessionInput = {
  title?: string;
  status?: "active" | "archived";
  metadata?: Record<string, unknown>;
};

export type CreateMessageInput = {
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type CreateAssetInput = {
  projectId?: string | null;
  sessionId?: string | null;
  messageId?: string | null;
  productId?: string | null;
  kind?: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number;
  storageBucket?: string | null;
  storagePath?: string | null;
  publicUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateJobInput = {
  projectId?: string | null;
  sessionId?: string | null;
  messageId?: string | null;
  toolCallId?: string | null;
  productId?: string | null;
  kind?: string;
  status?: string;
  inputJson?: Record<string, unknown>;
  creditEstimate?: number;
};

export type CreateJobEventInput = {
  jobId: string;
  eventType: string;
  message?: string | null;
  data?: Record<string, unknown>;
};

export type CreateCreditLedgerInput = {
  amount: number;
  source?: string;
  reason?: string | null;
  relatedJobId?: string | null;
  relatedSessionId?: string | null;
  metadata?: Record<string, unknown>;
};
