import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import PreviewCanvasFixStyles from "@/components/streams-builder/PreviewCanvasFixStyles";
import VisualEditorCanvasFixStyles from "@/components/streams-builder/VisualEditorCanvasFixStyles";
import VisualEditorCodeDock from "@/components/streams-builder/VisualEditorCodeDock";
import BuilderContextEventSink from "@/components/streams-builder/BuilderContextEventSink";
import CanonicalPreviewEventBridge from "@/components/streams-builder/CanonicalPreviewEventBridge";
import CanonicalPreviewWorkspaceSurface from "@/components/streams-builder/CanonicalPreviewWorkspaceSurface";
import VisualSelectionPatchPanel from "@/components/streams-builder/VisualSelectionPatchPanel";
import WorkspaceBridgeSourceOfTruth from "@/components/streams-builder/WorkspaceBridgeSourceOfTruth";

export const dynamic = "force-dynamic";

export default function StreamsAIStreamsBuilderPage() {
  return <main className="h-dvh min-h-dvh overflow-hidden bg-[#020713] text-white"><WorkspaceGrid /><WorkspaceBridgeSourceOfTruth /><BuilderContextEventSink /><CanonicalPreviewEventBridge /><CanonicalPreviewWorkspaceSurface /><VisualSelectionPatchPanel /><PreviewCanvasFixStyles /><VisualEditorCanvasFixStyles /><VisualEditorCodeDock /></main>;
}
