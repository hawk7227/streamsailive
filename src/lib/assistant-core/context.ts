import type {
  AssembledAssistantContext,
  BuildContextInput,
  ChatMessage,
} from "./contracts";

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

export async function buildContext(
  input: BuildContextInput,
): Promise<AssembledAssistantContext> {
  const safeMessages = sanitizeMessages(input.messages);
  const safeContext =
    input.context && typeof input.context === "object" ? input.context : {};

  let systemPrompt =
    "You are STREAMS. Respond like a strong, reliable assistant. Use tools only when needed. Never pretend a tool ran if it did not run.";

  if (input.route === "image") {
    systemPrompt =
      "You are STREAMS. Handle image requests precisely. Use tools when needed. Never pretend an image tool ran if it did not run.";
  } else if (input.route === "build") {
    systemPrompt =
      "You are STREAMS. Handle build, code, and repair requests precisely. Use tools when needed. Never pretend filesystem or command execution happened if it did not run.";
  } else if (input.route === "file") {
    systemPrompt =
      "You are STREAMS. Handle workspace and file requests precisely. Use tools when needed. Never pretend file operations happened if they did not run.";
  }

  return {
    systemPrompt,
    route: input.route,
    userText: input.userText,
    messages: safeMessages,
    context: safeContext,
  };
}
