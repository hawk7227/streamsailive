import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIWorkHistoryGate from "@/components/streams-ai/current-chat/StreamsAIWorkHistoryGate";
import StreamsAIMobileKeyboardBridge from "./StreamsAIMobileKeyboardBridge";
import "@/components/streams-ai/visual-operator/streams-operator-message-states.css";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "./StreamsAIMobileKeyboard.module.css";

export default function StreamsAIPage() {
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIMobileKeyboardBridge />
      <StreamsClientShell />
      <StreamsAIWorkHistoryGate />
    </>
  );
}
