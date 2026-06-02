import StreamsClientShell from "@/components/streams-ai/current-chat/StreamsClientShell";
import StreamsAIStudioFrame from "@/components/streams-ai/StreamsAIStudioFrame";

type StreamsAIPageProps = {
  searchParams?: Promise<{ embed?: string }> | { embed?: string };
};

export default async function StreamsAIPage({ searchParams }: StreamsAIPageProps) {
  const params = searchParams ? await searchParams : {};
  const embed = typeof params?.embed === "string" ? params.embed : "";

  // Important: this prevents iframe recursion.
  // /streams-ai?embed=chat renders only the real chat app.
  if (embed === "chat") {
    return <StreamsClientShell />;
  }

  // /streams-ai renders the studio shell:
  // left = full chat, center = preview/media editor, right = EditorPro/Quality Gate.
  return <StreamsAIStudioFrame />;
}
