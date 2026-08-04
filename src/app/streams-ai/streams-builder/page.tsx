import "./workspace-grid.css";
import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import BrainstormPreviewBootstrap from "@/components/streams-builder/BrainstormPreviewBootstrap";
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
        html,
        body {
          width: 100%;
          height: 100%;
          min-height: 100dvh;
          overflow: hidden;
          background: #020713;
        }

        .streamsBuilderShell {
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          overflow: hidden !important;
        }

        .streamsBuilderShell .workArea {
          width: 100%;
          height: 100% !important;
          min-height: 0 !important;
          padding-top: 160px !important;
          box-sizing: border-box;
          align-items: stretch !important;
          overflow: hidden !important;
        }

        .streamsBuilderShell .operatorColumn,
        .streamsBuilderShell .centerColumn,
        .streamsBuilderShell .visualColumn {
          height: 100% !important;
          min-height: 0 !important;
          align-self: stretch !important;
        }

        @media (max-width: 900px) {
          .streamsBuilderShell .workArea {
            padding-top: 24px !important;
          }
        }
      `}</style>
      <WorkspaceGrid />
      <BrainstormPreviewBootstrap />
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
