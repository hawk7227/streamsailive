import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import ConversationStateEmitter from "@/components/streams-ai/current-chat/ConversationStateEmitter";
import StreamsAIBuilderModeBridge from "./StreamsAIBuilderModeBridge";
import StreamsAIBuilderProofBridge from "./StreamsAIBuilderProofBridge";
import StreamsAIPageVisualFix from "./StreamsAIPageVisualFix";
import StreamsAIChatBehaviorTuning from "./StreamsAIChatBehaviorTuning";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";

export default function StreamsAIPage() {
  void mobileChatStyles;
  return <><StreamsAIBuilderModeBridge /><StreamsAIBuilderProofBridge /><StreamsAIPageVisualFix /><StreamsAIChatBehaviorTuning /><ConversationStateEmitter /><StreamsClientShell /></>;
}
