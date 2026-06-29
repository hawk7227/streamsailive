import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import PreviewCanvasFixStyles from "@/components/streams-builder/PreviewCanvasFixStyles";
import VisualEditorCanvasFixStyles from "@/components/streams-builder/VisualEditorCanvasFixStyles";

export const dynamic = "force-dynamic";

export default function StreamsAIStreamsBuilderPage() {
  return (
    <main className="h-dvh min-h-dvh overflow-hidden bg-[#020713] text-white">
      <WorkspaceGrid />
      <PreviewCanvasFixStyles />
      <VisualEditorCanvasFixStyles />
    </main>
  );
}
