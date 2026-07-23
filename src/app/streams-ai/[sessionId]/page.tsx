import StreamsUniversalExperience from "@/components/streams-ai/current-chat/StreamsUniversalExperience";
import StreamsAIMobileKeyboardBridge from "../StreamsAIMobileKeyboardBridge";
import "@/components/streams-ai/visual-operator/streams-operator-message-states.css";
import mobileChatStyles from "../StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "../StreamsAIMobileKeyboard.module.css";

export default function StreamsAISessionPage() {
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIMobileKeyboardBridge />
      <StreamsUniversalExperience />
    </>
  );
}
