import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIBuilderModeBridge from "./StreamsAIBuilderModeBridge";
import StreamsAIBuilderProofBridge from "./StreamsAIBuilderProofBridge";
import StreamsAIPageVisualFix from "./StreamsAIPageVisualFix";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";

export default function StreamsAIPage() {
  void mobileChatStyles;

  return (
    <>
      <StreamsAIBuilderModeBridge />
      <StreamsAIBuilderProofBridge />
      <StreamsAIPageVisualFix />
      <StreamsClientShell />
    </>
  );
}
