import { emitChatActionActivity } from "./streamsGlobalActivityBridge";
import { STREAMS_ACTIVITY_PHASES } from "./streamsActivityEvents";

export async function runStreamsSessionAction({ sessionId, action }) {
  if (!sessionId) {
    throw new Error("No active chat session selected.");
  }

  emitChatActionActivity(
    STREAMS_ACTIVITY_PHASES.RUNNING,
    `${action} chat...`,
    { tool: action, sessionId }
  );

  const response = await fetch("/api/streams-ai/sessions/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    const reason = data?.error || data?.details || `${action} chat failed`;

    emitChatActionActivity(
      STREAMS_ACTIVITY_PHASES.FAILED,
      reason,
      { tool: action, sessionId }
    );

    throw new Error(reason);
  }

  emitChatActionActivity(
    STREAMS_ACTIVITY_PHASES.COMPLETE,
    `${action} chat complete`,
    { tool: action, sessionId }
  );

  return data;
}
