import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import { ChatEditorDock } from "@/components/editor-pro/ChatEditorDock";

export default function StreamsAIPage() {
  return (
    <>
      <StreamsClientShell />
      <ChatEditorDock />
    </>
  );
}
