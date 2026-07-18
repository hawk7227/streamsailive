"use client";

import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import CanvasHeader from "./CanvasHeader";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function WorkspaceCanvas() {
  const { state } = useProjectWorkspace();
  return (
    <section className={state.fullscreenCanvas ? "workspaceCanvas fullscreen" : "workspaceCanvas"} aria-label="Main workspace canvas">
      <CanvasHeader />
      <div className="existingBuilderSurface" data-preserved-builder-surface="true">
        <WorkspaceGrid />
      </div>
    </section>
  );
}
