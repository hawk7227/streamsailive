import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIDesktopVisualBridge from "../StreamsAIDesktopVisualBridge";
import StreamsAIEmptyComposerPositionBridge from "../StreamsAIEmptyComposerPositionBridge";
import StreamsAIMobileKeyboardBridge from "../StreamsAIMobileKeyboardBridge";
import desktopConsoleStyles from "../StreamsAIDesktopConsole.module.css";
import mobileChatStyles from "../StreamsAIMobileChat.module.css";
import mobileKeyboardStyles from "../StreamsAIMobileKeyboard.module.css";

export default function StreamsAISessionPage() {
  void desktopConsoleStyles;
  void mobileChatStyles;
  void mobileKeyboardStyles;
  return (
    <>
      <StreamsAIDesktopVisualBridge />
      <StreamsAIEmptyComposerPositionBridge />
      <StreamsAIMobileKeyboardBridge />
      <StreamsClientShell />
    </>
  );
}
