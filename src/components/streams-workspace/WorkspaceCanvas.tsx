"use client";

import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function WorkspaceCanvas() {
  const { state } = useProjectWorkspace();
  return (
    <section className={state.fullscreenCanvas ? "workspaceCanvas fullscreen" : "workspaceCanvas"} aria-label="Main workspace canvas">
      <div className="existingBuilderSurface" data-preserved-builder-surface="true" data-first-working-row="manual-github-controls">
        <WorkspaceGrid />
      </div>
    </section>
  );
}
