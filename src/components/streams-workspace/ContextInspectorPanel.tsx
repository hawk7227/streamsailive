"use client";

import PullRequestReviewPanel from "@/components/streams-builder/PullRequestReviewPanel";
import { RIGHT_PANEL_SECTIONS } from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";
import type { WorkspaceInspectorTab } from "./workspace-state";

const tabs = Object.keys(RIGHT_PANEL_SECTIONS) as WorkspaceInspectorTab[];

export default function ContextInspectorPanel() {
  const { state, setInspectorTab } = useProjectWorkspace();
  if (!state.inspectorOpen) return null;

  const items = RIGHT_PANEL_SECTIONS[state.activeInspectorTab];
  return (
    <aside className="contextInspectorPanel" aria-label="Contextual utility panel">
      <div className="inspectorTabs" role="tablist" aria-label="Utility panel tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={state.activeInspectorTab === tab}
            className={state.activeInspectorTab === tab ? "active" : ""}
            onClick={() => setInspectorTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <section className="inspectorContent">
        <header><strong>{state.activeInspectorTab}</strong><span>Context follows the current project and selection</span></header>
        {state.activeInspectorTab === "Ask AI" ? (
          <div className="askAiPlaceholder" data-contextual-ask-ai="true">
            <p>Ask AI remains a supporting project tool. The existing builder chat connection stays authoritative while it is moved into this panel.</p>
            <button type="button">Open connected Builder Chat</button>
          </div>
        ) : state.activeInspectorTab === "Project Guidance" ? (
          <div className="projectGuidancePanel">
            <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
            <PullRequestReviewPanel />
          </div>
        ) : (
          <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
        )}
      </section>
    </aside>
  );
}
