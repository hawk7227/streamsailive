import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIPageVisualFix from "./StreamsAIPageVisualFix";

export default function StreamsAIPage() {
  return (
    <>
      <StreamsAIPageVisualFix />
      <StreamsClientShell />
    </>
  );
}
