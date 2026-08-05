import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import WorkspaceBridgeSourceOfTruth from "@/components/streams-builder/WorkspaceBridgeSourceOfTruth";
import BuilderContextEventSink from "@/components/streams-builder/BuilderContextEventSink";
import CanonicalPreviewEventBridge from "@/components/streams-builder/CanonicalPreviewEventBridge";
import CanonicalPreviewWorkspaceSurface from "@/components/streams-builder/CanonicalPreviewWorkspaceSurface";
import VisualSelectionPatchPanel from "@/components/streams-builder/VisualSelectionPatchPanel";
import VisualEditorCodeDock from "@/components/streams-builder/VisualEditorCodeDock";

export const dynamic = "force-dynamic";

/**
 * Three-column Builder workspace.
 *
 *   left   — chat            (BuilderCenterChat)
 *   center — code editor + frontend preview (LiveFrontendWorkstation)
 *   right  — visual editor   (VisualEditingWorkstation)
 *
 * The layout itself lives in WorkspaceGrid, which owns the CSS grid and
 * places all three panes. The components below render no visible UI — they
 * are event bridges and are kept because they carry real behavior.
 *
 * Removed from this page (pure `<style jsx global>` overrides that fought
 * the grid and forced the preview iframe to position:absolute / 2200px):
 *   - PreviewCanvasFixStyles
 *   - VisualEditorCanvasFixStyles
 *
 * Also removed: ProjectWorkspaceShell, which was rendering its own competing
 * layout in place of WorkspaceGrid.
 *
 * If the preview iframe sizes wrongly after this change, fix it inside
 * LiveFrontendWorkstation rather than reintroducing a global override.
 */
export default function StreamsAIWorkspacePage() {
  return (
    <>
      <WorkspaceGrid />
      <WorkspaceBridgeSourceOfTruth />
      <BuilderContextEventSink />
      <CanonicalPreviewEventBridge />
      <CanonicalPreviewWorkspaceSurface />
      <VisualSelectionPatchPanel />
      <VisualEditorCodeDock />
    </>
  );
}

