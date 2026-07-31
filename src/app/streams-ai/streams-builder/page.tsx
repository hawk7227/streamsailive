import "./workspace-grid.css";
import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import PreviewCanvasFixStyles from "@/components/streams-builder/PreviewCanvasFixStyles";
import VisualEditorCanvasFixStyles from "@/components/streams-builder/VisualEditorCanvasFixStyles";
import VisualEditorCodeDock from "@/components/streams-builder/VisualEditorCodeDock";
import BuilderContextEventSink from "@/components/streams-builder/BuilderContextEventSink";
import CanonicalPreviewEventBridge from "@/components/streams-builder/CanonicalPreviewEventBridge";
import VisualSelectionPatchPanel from "@/components/streams-builder/VisualSelectionPatchPanel";
import WorkspaceBridgeSourceOfTruth from "@/components/streams-builder/WorkspaceBridgeSourceOfTruth";
import DefaultSplitWorkstationOpener from "@/components/streams-builder/DefaultSplitWorkstationOpener";

export const dynamic = "force-dynamic";

export default function StreamsAIStreamsBuilderPage() {
  return (
    <>
      <style>{`
        .streamsBuilderShell .workArea {
          padding-top: 160px !important;
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .streamsBuilderShell .workArea {
            padding-top: 24px !important;
          }
        }
      `}</style>
      <WorkspaceGrid />
      <DefaultSplitWorkstationOpener />
      <WorkspaceBridgeSourceOfTruth />
      <BuilderContextEventSink />
      <CanonicalPreviewEventBridge />
      <VisualSelectionPatchPanel />
      <PreviewCanvasFixStyles />
      <VisualEditorCanvasFixStyles />
      <VisualEditorCodeDock />
    </>
  );
}
