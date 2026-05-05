export type StreamsPersistedMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  artifact_ids?: string[];
  metadata?: Record<string, unknown>;
};

function streamsHeaders(userId: string) {
  return {
    "Content-Type": "application/json",
    "x-streams-user-id": userId,
  };
}

export async function createStreamsChatSession(input: {
  userId: string;
  workspaceId: string;
  title: string;
}) {
  const res = await fetch("/api/streams/chat/sessions", {
    method: "POST",
    headers: streamsHeaders(input.userId),
    body: JSON.stringify({
      userId: input.userId,
      workspaceId: input.workspaceId,
      title: input.title,
      activeTab: "chat",
      metadata: { source: "UnifiedChatPanel" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Failed to create chat session.");
    throw new Error(text || "Failed to create chat session.");
  }

  const payload = (await res.json()) as { data?: { id?: string } };
  return payload.data?.id ?? null;
}

export async function getLatestStreamsChatSession(input: {
  userId: string;
  workspaceId: string;
}) {
  const res = await fetch(
    `/api/streams/chat/sessions?workspaceId=${encodeURIComponent(input.workspaceId)}`,
    {
      method: "GET",
      headers: streamsHeaders(input.userId),
    },
  );

  if (!res.ok) return null;

  const payload = (await res.json()) as { data?: Array<{ id: string }> };
  return payload.data?.[0]?.id ?? null;
}

export async function getStreamsChatMessages(input: {
  userId: string;
  sessionId: string;
}) {
  const res = await fetch(`/api/streams/chat/sessions/${input.sessionId}/messages`, {
    method: "GET",
    headers: streamsHeaders(input.userId),
  });

  if (!res.ok) return [];

  const payload = (await res.json()) as { data?: StreamsPersistedMessage[] };
  return payload.data ?? [];
}

export async function persistStreamsChatMessage(input: {
  userId: string;
  workspaceId: string;
  sessionId: string | null;
  role: "user" | "assistant";
  content: string;
  artifactIds?: string[];
  metadata?: Record<string, unknown>;
}) {
  if (!input.sessionId) return;

  const res = await fetch(`/api/streams/chat/sessions/${input.sessionId}/messages`, {
    method: "POST",
    headers: streamsHeaders(input.userId),
    body: JSON.stringify({
      userId: input.userId,
      workspaceId: input.workspaceId,
      role: input.role,
      content: input.content,
      artifactIds: input.artifactIds ?? [],
      metadata: input.metadata ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Failed to persist chat message.");
    console.warn("Failed to persist chat message:", text);
  }
}
