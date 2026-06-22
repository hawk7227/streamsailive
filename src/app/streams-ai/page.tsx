import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIPageVisualFix from "./StreamsAIPageVisualFix";
import StreamsAIComposerActiveNavFix from "./StreamsAIComposerActiveNavFix";

export default function StreamsAIPage() {
  return (
    <>
      <StreamsAIPageVisualFix />
      <StreamsAIComposerActiveNavFix />
      <StreamsClientShell />
    </>
  );
}
