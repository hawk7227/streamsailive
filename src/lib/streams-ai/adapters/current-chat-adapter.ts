export const CURRENT_STREAMS_CHAT_URL =
  "https://streamsailive-chat-streamsa-git-9a8852-marcus-projects-d02c47f6.vercel.app/";

export type StreamsAIBridgeStatus = {
  mode: "bridge";
  source: "streamsailive-chat-streamsai";
  targetWorkspaceId: "streams-ai";
  targetModuleId: "streams-ai-core";
  storageStatus: "external-ui-mounted" | "streams-ai-api-ready";
};

export function getCurrentChatBridgeStatus(): StreamsAIBridgeStatus {
  return {
    mode: "bridge",
    source: "streamsailive-chat-streamsai",
    targetWorkspaceId: "streams-ai",
    targetModuleId: "streams-ai-core",
    storageStatus: "streams-ai-api-ready",
  };
}

export function getCurrentChatUrl() {
  return CURRENT_STREAMS_CHAT_URL;
}
