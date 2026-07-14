import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIMobileKeyboardBridge from "../StreamsAIMobileKeyboardBridge";
import mobileChatStyles from "../StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "../StreamsAIMobileKeyboard.module.css";

export default function StreamsAISessionPage() {
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIMobileKeyboardBridge />
      <StreamsClientShell />
    </>
  );
}
