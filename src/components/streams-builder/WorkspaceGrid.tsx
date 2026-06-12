"use client";

import { useState } from "react";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";

export default function WorkspaceGrid() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className={`workspace ${sidebarOpen ? "open" : "closed"}`}>
      <aside className="left">
        <button className="toggle" type="button" onClick={() => setSidebarOpen((value) => !value)}>
          {sidebarOpen ? "Close" : "Open"}
        </button>

        <nav>
          {["1", "2", "3", "4", "5", "6"].map((item) => (
            <button type="button" key={item}>{item}</button>
          ))}
        </nav>

        {sidebarOpen ? (
          <section>
            <h2>Workspaces</h2>
            <p>Agent 1</p>
            <p>Agent 2</p>
            <p>Agent 3</p>
            <p>Agent 4</p>
            <p>Agent 5</p>
            <p>Agent 6</p>
          </section>
        ) : null}
      </aside>

      <section className="center">
        <header className="top">
          <div>
            <p>STREAMS BUILDER</p>
            <h1>Six Independent GitHub Workspaces</h1>
          </div>

          <div className="locks">
            <span>Active Branch</span>
            <b>main</b>
            <strong>Main File Only</strong>
          </div>
        </header>

        <GitHubRepositoryPicker />
      </section>

      <aside className="settings">
        <h2>Settings</h2>
        <p>Rules moved here to keep the workstations full screen.</p>
        <p>Each AI agent owns only its selected repo/file context.</p>
        <p>Agents never cross stations.</p>
      </aside>

      <style jsx>{`
        .workspace {
          height: 100%;
          min-height: 0;
          display: grid;
          grid-template-columns: 54px minmax(0,1fr) 168px;
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
        }
        .workspace.open {
          grid-template-columns: 190px minmax(0,1fr) 168px;
        }
        .left,
        .center,
        .settings {
          min-height: 0;
          border: 1px solid rgba(148,163,184,.16);
          border-radius: 14px;
          background: rgba(15,23,42,.78);
          overflow: hidden;
        }
        .left {
          padding: 6px;
        }
        .toggle {
          width: 100%;
          height: 32px;
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 8px;
          background: #7c3aed;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
        }
        nav {
          display: grid;
          gap: 7px;
          margin-top: 8px;
        }
        nav button {
          height: 36px;
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 10px;
          background: #020617;
          color: #fff;
          font-weight: 900;
        }
        .left section {
          margin-top: 12px;
          font-size: 12px;
        }
        .left h2 {
          margin: 0 0 8px;
          font-size: 13px;
        }
        .left p {
          margin: 0 0 7px;
          color: #cbd5e1;
        }
        .center {
          padding: 8px;
          display: grid;
          grid-template-rows: auto minmax(0,1fr);
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .top p {
          margin: 0;
          color: #6ee7b7;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .08em;
        }
        .top h1 {
          margin: 2px 0 0;
          font-size: 18px;
        }
        .locks {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }
        .locks b,
        .locks strong {
          border: 1px solid rgba(16,185,129,.35);
          border-radius: 8px;
          padding: 6px 9px;
          background: rgba(6,78,59,.18);
          color: #6ee7b7;
        }
        .settings {
          padding: 10px;
          font-size: 11px;
          line-height: 1.35;
        }
        .settings h2 {
          margin: 0 0 10px;
          font-size: 13px;
        }
        .settings p {
          margin: 0 0 8px;
          color: #cbd5e1;
        }
      `}</style>
    </main>
  );
}
