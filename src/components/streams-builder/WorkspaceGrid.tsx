"use client";

import { useState } from "react";
import BuilderCenterChat from "./BuilderCenterChat";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import WorkspaceModulePanel from "./workspace-modules/WorkspaceModulePanel";

const MODULES = [
  "Component Mapping",
  "Approval Center",
  "Browser Verification",
  "Repository Truth",
  "Projects Dashboard",
  "Truth Panel",
] as const;

type ModuleName = (typeof MODULES)[number];
type ViewMode = "Single" | "Multi" | "Focus" | "Stack";

export default function WorkspaceGrid() {
  const [activeModule, setActiveModule] = useState<ModuleName>("Component Mapping");
  const [viewMode, setViewMode] = useState<ViewMode>("Single");
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <main className={`streamsBuilderShell mode${viewMode}`}>
      <section className="centerWorkspace">
        <div className="topRow">
          <GitHubRepositoryPicker />
          <div className="controls">
            <label><b>Workstation</b><select value={activeModule} onChange={(event) => setActiveModule(event.target.value as ModuleName)}>{MODULES.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label><b>View Mode</b><select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}><option>Single</option><option>Multi</option><option>Focus</option><option>Stack</option></select></label>
          </div>
        </div>

        <section className="workArea">
          <BuilderCenterChat />
          <section className="workstationShell">
            <WorkspaceModulePanel moduleName={activeModule} />
            <button className="statusToggle" type="button" onClick={() => setStatusOpen((value) => !value)}>
              {statusOpen ? "Hide" : "Show"} Status / Readiness / Files / Context
            </button>
            {statusOpen ? (
              <div className="statusDrop">
                <p><b>Status</b><span>{activeModule}</span></p>
                <p><b>Readiness</b><span>Existing readiness only.</span></p>
                <p><b>Files</b><span>Attached to this workstation.</span></p>
                <p><b>Context</b><span>Current workstation context.</span></p>
              </div>
            ) : null}
          </section>
        </section>
      </section>

      <style jsx global>{`html,body{width:100vw;height:100dvh;overflow:hidden;}`}</style>
      <style jsx>{`
        .streamsBuilderShell{width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);gap:6px;overflow:hidden;background:#020713;color:#fff;padding:6px;box-sizing:border-box;}
        .centerWorkspace{min-width:0;min-height:0;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);overflow:hidden;box-sizing:border-box;padding:6px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;}
        .topRow{display:grid;grid-template-columns:minmax(240px,1fr) minmax(0,1fr);gap:6px;min-width:0;}
        .controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0;}
        label{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:10px;background:#020617;padding:6px;}
        label b,.statusDrop b{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;}
        select{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:11px;outline:none;}option{color:#020617;}
        .workArea{min-width:0;min-height:0;display:grid;grid-template-columns:minmax(320px,430px) minmax(0,1fr);gap:6px;overflow:hidden;}
        .modeFocus .workArea{grid-template-columns:minmax(300px,360px) minmax(0,1fr);}
        .workstationShell{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto auto;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);overflow:hidden;}
        .workstationShell :global(.streamsModulePanel){margin:6px;overflow:auto;}
        .statusToggle{height:28px;border:0;border-top:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.84);color:#cbd5e1;font-size:10px;font-weight:900;text-align:left;padding:0 10px;cursor:pointer;}
        .statusDrop{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border-top:1px solid rgba(148,163,184,.12);padding:6px;max-height:140px;overflow:auto;background:rgba(2,6,23,.72);}
        .statusDrop p{min-width:0;margin:0;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(15,23,42,.72);padding:7px;}.statusDrop span{display:block;color:#cbd5e1;font-size:10px;line-height:1.35;overflow-wrap:anywhere;}
        @media(max-width:1180px){.topRow,.controls,.workArea,.modeFocus .workArea{grid-template-columns:minmax(0,1fr);}.centerWorkspace,.workArea{overflow:auto;}.statusDrop{grid-template-columns:repeat(2,minmax(0,1fr));}}
      `}</style>
    </main>
  );
}
