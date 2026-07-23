import StreamsProjectRouteShell from "@/components/streams-ai/current-chat/StreamsProjectRouteShell";

export const dynamic = "force-dynamic";

export default function StreamsGenerateVideoPage() {
  return (
    <StreamsProjectRouteShell
      mode="gen-video"
      title="Streams Video Generation"
      description="Dedicated video-generation project route using the existing Streams chat, uploads, assets, generation tools, and project memory."
    />
  );
}
