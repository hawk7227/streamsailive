import StreamsProjectRouteShell from "@/components/streams-ai/current-chat/StreamsProjectRouteShell";

export const dynamic = "force-dynamic";

export default function StreamsResearchPage() {
  return (
    <StreamsProjectRouteShell
      mode="research"
      title="Streams Research"
      description="Dedicated research project route using the existing Streams conversation, memory, files, and research runtime."
    />
  );
}
