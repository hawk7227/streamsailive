import StreamsUniversalExperience from "@/components/streams-ai/current-chat/StreamsUniversalExperience";
import StreamsAIWorkHistoryBridge from "@/components/streams-ai/current-chat/StreamsAIWorkHistoryBridge";
import StreamsAIMobileKeyboardBridge from "./StreamsAIMobileKeyboardBridge";
import "@/components/streams-ai/visual-operator/streams-operator-message-states.css";
import "@/components/streams-ai/current-chat/streams-builder-chat-theme.css";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "./StreamsAIMobileKeyboard.module.css";

export default function StreamsAIPage() {
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIMobileKeyboardBridge />
      <StreamsUniversalExperience />
      <StreamsAIWorkHistoryBridge />
    </>
  );
}
