export type AssistantMode = "chat" | "image" | "video" | "build" | "file";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type NormalizedAssistantRequest = {
  userText: string;
  messages: ChatMessage[];
  context: Record<string, unknown>;
};

export type BuildContextInput = {
  route: AssistantMode;
  userText: string;
  messages?: ChatMessage[];
  context?: Record<string, unknown>;
  /** Present when the request originates from an authenticated workspace session. */
  workspaceId?: string;
  /** Present when the request is tied to a specific conversation. */
  conversationId?: string;
};

export type AssembledAssistantContext = {
  systemPrompt: string;
  route: AssistantMode;
  userText: string;
  messages: ChatMessage[];
  context: Record<string, unknown>;
  /** Populated when workspaceId is present — injected file context for this turn. */
  fileContext?: string;
  workspaceId?: string;
  conversationId?: string;
};

export type BuildAssistantToolsInput = {
  route: AssistantMode;
  context: AssembledAssistantContext;
};

export type ExecuteAssistantToolInput = {
  name: string;
  args: Record<string, unknown>;
  route: AssistantMode;
  context: AssembledAssistantContext;
};

export type ToolProgressHandlers = {
  onProgress?: (text: string) => void;
};
