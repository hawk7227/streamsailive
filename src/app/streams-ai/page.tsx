import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "./StreamsAIMobileKeyboard.module.css";

export default function StreamsAIPage() {
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return <StreamsClientShell />;
}
