/**
 * src/lib/assistant-core/context.ts
 *
 * Context assembly for the assistant orchestrator.
 *
 * Responsibilities:
 * - Build the system prompt for the resolved route
 * - Retrieve relevant file chunks when workspaceId is present
 * - Inject file context as a dedicated system prompt section
 *
 * PRD rule: "minimal relevant chunks — never full history dump."
 * File context is retrieved via semantic search on the user's current message,
 * not pre-injected wholesale. Empty result = no injection (no bloat).
 */

import type {
  AssembledAssistantContext,
  BuildContextInput,
  ChatMessage,
} from "./contracts";
import { buildFileContext } from "@/lib/files/retrieval";

function sanitizeMessages(messages?: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(
    (message): message is ChatMessage =>
      !!message &&
      (message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant") &&
      typeof message.content === "string",
  );
}

function buildSystemPromptBase(route: BuildContextInput["route"]): string {
  switch (route) {
    case "image":
      return "You are STREAMS. Handle image requests precisely. Use tools when needed. Never pretend an image tool ran if it did not run.";
    case "video":
      return "You are STREAMS. Handle video and image-to-video requests precisely. Use tools when needed. Never pretend a media tool ran if it did not run.";
    case "build":
      return "You are STREAMS. Handle build, code, and repair requests precisely. Use tools when needed. Never pretend filesystem or command execution happened if it did not run.";
    case "file":
      return "You are STREAMS. Handle workspace and file requests precisely. Use tools when needed. Never pretend file operations happened if they did not run.";
    default:
      return "You are STREAMS. Respond like a strong, reliable assistant. Use tools only when needed. Never pretend a tool ran if it did not run.";
  }
}

function appendFileContext(systemPrompt: string, fileContext: string): string {
  if (!fileContext.trim()) return systemPrompt;
  return (
    systemPrompt +
    "\n\n--- Relevant file context (retrieved for this turn only) ---\n" +
    fileContext +
    "\n--- End of file context ---"
  );
}

export async function buildContext(
  input: BuildContextInput,
): Promise<AssembledAssistantContext> {
  const safeMessages = sanitizeMessages(input.messages);
  const safeContext =
    input.context && typeof input.context === "object" ? input.context : {};

  const basePrompt = buildSystemPromptBase(input.route);

  // Retrieve file context when workspaceId is present.
  // Semantic search against the user's current message — returns empty string
  // when no relevant files exist, keeping context minimal per PRD §4.
  let fileContext = "";
  if (input.workspaceId && input.userText.trim()) {
    try {
      fileContext = await buildFileContext(
        input.workspaceId,
        input.userText,
        6, // max 6 chunks — keeps context bounded
      );
    } catch (err) {
      // Retrieval failure is non-fatal — assistant continues without file context
      console.error(
        JSON.stringify({
          level: "error",
          event: "FILE_CONTEXT_RETRIEVAL_FAILED",
          workspaceId: input.workspaceId,
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const systemPrompt = appendFileContext(basePrompt, fileContext);

  return {
    systemPrompt,
    route: input.route,
    userText: input.userText,
    messages: safeMessages,
    context: safeContext,
    fileContext: fileContext || undefined,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  };
}
