import type { RuntimeOperation } from "./contracts";

const EXECUTION_CLAIMS = /\b(?:I have|I've|has been|is now)\s+(?:built|created|saved|deployed|opened|generated|completed)|\b(?:preview|build|project|files?)\s+(?:is|are)\s+(?:ready|complete|saved|available)\b/i;

export function assertExecutionClaimsGrounded(content: string, operation?: RuntimeOperation | null) {
  if (!EXECUTION_CLAIMS.test(String(content || ""))) return;
  const complete = operation?.status === "completed" && operation.stage === "COMPLETED";
  const hasProof = Boolean(operation?.artifacts?.length && (operation.previewId || operation.previewUrl));
  if (!complete || !hasProof) throw new Error("STREAMS_UNGROUNDED_EXECUTION_CLAIM");
}

export function runtimeCompletionMessage(operation: RuntimeOperation) {
  if (operation.status === "failed" && operation.failure) return operation.failure.safeMessage;
  if (operation.intent === "CREATE_WEBSITE" && operation.previewUrl) return `Your frontend preview is ready: ${operation.previewUrl}`;
  if (operation.intent === "OPEN_PREVIEW" && operation.previewUrl) return `Opening the saved frontend preview: ${operation.previewUrl}`;
  return "The operation completed.";
}
