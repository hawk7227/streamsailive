"use client";

import ContextInspectorPanel from "./ContextInspectorPanel";
import ProjectContextPanel from "./ProjectContextPanel";
import { useProjectWorkspace } from "./ProjectWorkspaceController";
import type { WorkspaceInspectorTab } from "./workspace-state";

const utilityTabs: WorkspaceInspectorTab[] = [
  "Properties",
  "Content",
  "Generate",
  "Project Guidance",
  "Ask AI",
];

export default function FloatingWorkspacePanels() {
  const { state, setState, setInspectorTab } = useProjectWorkspace();

  function openProjectContext() {
    setState((current) => ({
      ...current,
      projectPanelOpen: true,
      inspectorOpen: false,
    }));
  }

  function openUtility(tab: WorkspaceInspectorTab) {
    setInspectorTab(tab);
    setState((current) => ({
      ...current,
      projectPanelOpen: false,
      inspectorOpen: true,
    }));
  }

  function closePanels() {
    setState((current) => ({
      ...current,
      projectPanelOpen: false,
      inspectorOpen: false,
    }));
  }

  return (
    <>
      {(state.projectPanelOpen || state.inspectorOpen) ? (
        <button
          type="button"
          className="floatingPanelBackdrop"
          aria-label="Close floating workspace panel"
          onClick={closePanels}
        />
      ) : null}

      {state.projectPanelOpen ? (
        <section className="floatingWorkspaceDrawer floatingWorkspaceDrawerLeft" aria-label="Floating project context">
          <button type="button" className="floatingPanelClose" onClick={closePanels} aria-label="Close project context">×</button>
          <ProjectContextPanel />
        </section>
      ) : null}

      {state.inspectorOpen ? (
        <section className="floatingWorkspaceDrawer floatingWorkspaceDrawerRight" aria-label="Floating utility panel">
          <button type="button" className="floatingPanelClose" onClick={closePanels} aria-label="Close utility panel">×</button>
          <ContextInspectorPanel />
        </section>
      ) : null}

      <nav className="floatingWorkspaceSwitcher" aria-label="Workspace panel preview switcher">
        <button
          type="button"
          className={state.projectPanelOpen ? "active" : ""}
          onClick={openProjectContext}
        >
          Project
        </button>
        {utilityTabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={state.inspectorOpen && state.activeInspectorTab === tab ? "active" : ""}
            onClick={() => openUtility(tab)}
          >
            {tab === "Project Guidance" ? "Guidance" : tab}
          </button>
        ))}
        {(state.projectPanelOpen || state.inspectorOpen) ? (
          <button type="button" onClick={closePanels}>Close</button>
        ) : null}
      </nav>
    </>
  );
}
