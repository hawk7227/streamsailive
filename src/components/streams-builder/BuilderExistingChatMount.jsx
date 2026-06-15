"use client";

import StreamsOperatorShell from "../streams-ai/visual-operator/StreamsOperatorShell";
import { useStreamsChatRuntime } from "../streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime";

export default function BuilderExistingChatMount() {
  const chatRuntime = useStreamsChatRuntime();
  return <StreamsOperatorShell chatRuntime={chatRuntime} />;
}
