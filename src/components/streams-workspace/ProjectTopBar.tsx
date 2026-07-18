"use client";

import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function ProjectTopBar() {
  const { state, toggleProjectPanel, toggleInspector, toggleTray } = useProjectWorkspace();

  return (
    <header className="projectTopBar">
      <div className="projectIdentity">
        <button type="button" className="brandButton" aria-label="StreamsAI home">S</button>
        <div className="projectTitleBlock">
          <strong>{state.projectName}</strong>
          <span>{state.projectType} · {state.projectStatus} · {state.saveStatus}</span>
        </div>
      </div>
      <nav aria-label="Project actions" className="projectActions">
        <button type="button">Version history</button>
        <button type="button">Preview</button>
        <button type="button">Share</button>
        <button type="button">Export</button>
        <button type="button" className="primaryAction">Publish / Complete</button>
        <button type="button" aria-label="User profile" className="profileButton">MH</button>
        <button type="button" onClick={toggleProjectPanel} aria-label="Toggle project context">Context</button>
        <button type="button" onClick={toggleInspector} aria-label="Toggle utility panel">Utility</button>
        <button type="button" onClick={toggleTray} aria-label="Toggle bottom tray">Tray</button>
      </nav>
    </header>
  );
}
