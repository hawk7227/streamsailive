import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import ConversationStateEmitter from "@/components/streams-ai/current-chat/ConversationStateEmitter";
import StreamsAIBuilderProofBridge from "../StreamsAIBuilderProofBridge";
import StreamsAIPageVisualFix from "../StreamsAIPageVisualFix";
import StreamsAIChatBehaviorTuning from "../StreamsAIChatBehaviorTuning";
import mobileChatStyles from "../StreamsAIMobileChat.module.css";

export const dynamic = "force-dynamic";

export default function StreamsAIBuilderEmbedPage() {
  void mobileChatStyles;
  return (
    <>
      <StreamsAIBuilderProofBridge />
      <StreamsAIPageVisualFix />
      <StreamsAIChatBehaviorTuning />
      <ConversationStateEmitter />
      <StreamsClientShell />
    </>
  );
}
