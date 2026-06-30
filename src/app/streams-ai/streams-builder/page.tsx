import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import PreviewCanvasFixStyles from "@/components/streams-builder/PreviewCanvasFixStyles";
import VisualEditorCanvasFixStyles from "@/components/streams-builder/VisualEditorCanvasFixStyles";
import VisualEditorCodeDock from "@/components/streams-builder/VisualEditorCodeDock";
import BuilderContextEventSink from "@/components/streams-builder/BuilderContextEventSink";
import CanonicalPreviewEventBridge from "@/components/streams-builder/CanonicalPreviewEventBridge";
import CanonicalPreviewWorkspaceSurface from "@/components/streams-builder/CanonicalPreviewWorkspaceSurface";

export const dynamic = "force-dynamic";

export default function StreamsAIStreamsBuilderPage() {
  return <main className="h-dvh min-h-dvh overflow-hidden bg-[#020713] text-white"><WorkspaceGrid /><BuilderContextEventSink /><CanonicalPreviewEventBridge /><CanonicalPreviewWorkspaceSurface /><PreviewCanvasFixStyles /><VisualEditorCanvasFixStyles /><VisualEditorCodeDock /></main>;
}
