import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIFastReplyBridge from "./StreamsAIFastReplyBridge";
import StreamsAIMobileKeyboardBridge from "./StreamsAIMobileKeyboardBridge";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "./StreamsAIMobileKeyboard.module.css";

export default function StreamsAIPage() {
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIFastReplyBridge />
      <StreamsAIMobileKeyboardBridge />
      <StreamsClientShell />
    </>
  );
}
