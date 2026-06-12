"use client";

import { useState } from "react";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import WorkspaceModulePanel from "./workspace-modules/WorkspaceModulePanel";

const WORKSPACES = [
  "Primary Builder",
  "Visual Editing",
  "Component Mapping",
  "Approval Center",
  "Browser Verification",
  "Repository Truth",
  "Projects Dashboard",
  "Truth Panel",
];

export default function WorkspaceGrid() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<"Component Mapping" | "Approval Center" | "Browser Verification" | "Repository Truth" | "Projects Dashboard" | "Truth Panel">("Component Mapping");

  const shellClass = sidebarOpen
    ? "streamsBuilderShell sidebarOpen"
    : "streamsBuilderShell sidebarClosed";

  return (
    <main className={shellClass}>
      <aside className="leftRail">
        <button
          className="toggleButton"
          type="button"
          onClick={() => setSidebarOpen((value) => !value)}
        >
          {sidebarOpen ? "Close" : "Open"}
        </button>

        <nav>
          {WORKSPACES.map((workspace, index) => (
            <button
              type="button"
              key={workspace}
              className={workspace === activeModule ? "active" : ""}
              onClick={() => {
                if (
                  workspace === "Component Mapping" ||
                  workspace === "Approval Center" ||
                  workspace === "Browser Verification" ||
                  workspace === "Repository Truth" ||
                  workspace === "Projects Dashboard" ||
                  workspace === "Truth Panel"
                ) {
                  setActiveModule(workspace);
                }
              }}
            >
              <span>{index === 7 ? "T" : index + 1}</span>
              {sidebarOpen ? <b>{workspace}</b> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="centerWorkspace">
        <GitHubRepositoryPicker />
        <WorkspaceModulePanel moduleName={activeModule} />
      </section>

      <aside className="settingsRail">
        <h2>Settings</h2>

        <p>
          <b>Mode</b>
          <span>Main File Only</span>
        </p>

        <p>
          <b>Agent Rule</b>
          <span>Each workstation owns only its selected repo/file context.</span>
        </p>

        <p>
          <b>Proof Rule</b>
          <span>No “done” without live browser proof, source truth, changed-file audit, and user approval.</span>
        </p>

        <p>
          <b>Blocked</b>
          <span>Unrelated provider runtime types are recorded separately.</span>
        </p>
      </aside>

      <style jsx>{`
        .streamsBuilderShell {
          width: 100vw;
          height: 100dvh;
          max-width: 100vw;
          max-height: 100dvh;
          min-height: 0;
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr) 180px;
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
          box-sizing: border-box;
        }

        .streamsBuilderShell.sidebarOpen {
          grid-template-columns: 190px minmax(0, 1fr) 180px;
        }

        .leftRail,
        .centerWorkspace,
        .settingsRail {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          overflow: hidden;
          box-sizing: border-box;
        }

        .leftRail {
          padding: 6px;
        }

        .toggleButton {
          width: 100%;
          height: 34px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 10px;
          background: #7c3aed;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        nav {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        nav button {
          min-width: 0;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: #020617;
          color: #fff;
          cursor: pointer;
        }

        nav button.active {
          background: linear-gradient(135deg, #7c3aed, #4c1d95);
          border-color: rgba(167, 139, 250, 0.55);
        }

        nav span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 13px;
          font-weight: 900;
          flex: 0 0 auto;
        }

        nav b {
          flex: 1;
          min-width: 0;
          text-align: left;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .centerWorkspace {
          padding: 6px;
          overflow: auto;
        }

        .settingsRail {
          padding: 10px;
          overflow: auto;
          font-size: 11px;
          line-height: 1.35;
        }

        .settingsRail h2 {
          margin: 0 0 12px;
          font-size: 14px;
        }

        .settingsRail p {
          margin: 0 0 12px;
          color: #cbd5e1;
        }

        .settingsRail b {
          display: block;
          color: #6ee7b7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 3px;
        }

        .settingsRail span {
          display: block;
        }
      `}</style>
    </main>
  );
}





