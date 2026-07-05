import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIMobileKeyboardBridge from "./StreamsAIMobileKeyboardBridge";
import desktopConsoleStyles from "./StreamsAIDesktopConsole.module.css";
import mobileChatStyles from "./StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "./StreamsAIMobileKeyboard.module.css";

export default function StreamsAIPage() {
  void desktopConsoleStyles;
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIMobileKeyboardBridge />
      <StreamsClientShell />
    </>
  );
}
