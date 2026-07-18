"use client";

import {
  CODING_BOTTOM_TRAY_EXTENSIONS,
  UNIVERSAL_BOTTOM_TRAY_ITEMS,
} from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";
import type { WorkspaceTrayTab } from "./workspace-state";

const tabs = [...UNIVERSAL_BOTTOM_TRAY_ITEMS, ...CODING_BOTTOM_TRAY_EXTENSIONS] as WorkspaceTrayTab[];

export default function WorkspaceBottomTray() {
  const { state, setTrayTab, toggleTray } = useProjectWorkspace();
  return (
    <section className={state.trayOpen ? "workspaceBottomTray open" : "workspaceBottomTray"} aria-label="Workspace supporting materials">
      <div className="trayTabs" role="tablist" aria-label="Workspace tray tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={state.activeTrayTab === tab}
            className={state.activeTrayTab === tab ? "active" : ""}
            onClick={() => setTrayTab(tab)}
          >
            {tab}
          </button>
        ))}
        <button type="button" className="trayToggle" onClick={toggleTray}>{state.trayOpen ? "Collapse" : "Expand"}</button>
      </div>
      {state.trayOpen ? (
        <div className="trayContent" role="tabpanel">
          <strong>{state.activeTrayTab}</strong>
          <span>The existing builder activity, logs, proof, diff, outputs, assets, and versions will be connected here without duplicating their current systems.</span>
        </div>
      ) : null}
    </section>
  );
}
