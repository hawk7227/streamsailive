import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { listStreamsMemories, readSessionSummary, summarizeMemoriesForPrompt, writeSessionSummary } from "@/lib/streams-ai/memory-service";

export async function buildStreamsMemoryContext(scope: StreamsAIScope, sessionId: string, userMessage: string) {
  const memoryResult = await listStreamsMemories(scope, userMessage, { sessionId, projectId: scope.defaultProjectId, limit: 12, scopes: ["user", "project", "session", "org"] });
  const sessionSummary = await readSessionSummary(scope, sessionId);
  return {
    memories: memoryResult.memories || [],
    sessionSummary,
    contextText: [
      "Streams durable context:",
      `threadSummary: ${sessionSummary || "No saved thread summary."}`,
      `relevantSavedContext:\n${summarizeMemoriesForPrompt((memoryResult.memories || []) as Record<string, unknown>[])}`,
      "Use saved context only when relevant to the current request.",
    ].join("\n"),
  };
}

export async function saveThreadSummary(scope: StreamsAIScope, sessionId: string, userMessage: string, assistantMessage: string) {
  const summary = [
    "Recent thread state:",
    `User: ${userMessage.slice(0, 1200)}`,
    `Assistant: ${assistantMessage.slice(0, 1200)}`,
  ].join("\n");
  return writeSessionSummary(scope, sessionId, summary, { source: "chat-turn" });
}
