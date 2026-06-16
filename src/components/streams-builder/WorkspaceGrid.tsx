"use client";

import { useState } from "react";
import AgentOneWorkstation from "./AgentOneWorkstation";
import BuilderCenterChat from "./BuilderCenterChat";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import WorkstationChromeEnhancer from "./WorkstationChromeEnhancer";
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
    <main className="streamsBuilderShell">
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
            <div className="stationViewport"><AgentOneWorkstation /></div>
            <button className="statusToggle" type="button" onClick={() => setStatusOpen((value) => !value)}>{statusOpen ? "Hide" : "Show"} Component Mapping / Status Below</button>
            {statusOpen ? <div className="stationContext"><WorkspaceModulePanel moduleName={activeModule} /></div> : null}
          </section>
        </section>
      </section>
      <WorkstationChromeEnhancer />
      <style jsx>{`
        .streamsBuilderShell{width:100vw;height:100dvh;display:grid;background:#020713;color:#fff;padding:6px;box-sizing:border-box;overflow:hidden;}
        .centerWorkspace{min-width:0;min-height:0;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);overflow:hidden;padding:6px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;}
        .topRow{display:grid;grid-template-columns:minmax(240px,1fr) minmax(0,1fr);gap:6px;min-width:0;}
        .controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0;}
        label{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:10px;background:#020617;padding:6px;}
        label b{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;margin-bottom:3px;}
        select{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:11px;outline:none;}option{color:#020617;}
        .workArea{min-width:0;min-height:0;display:grid;grid-template-columns:minmax(320px,430px) minmax(0,1fr);gap:6px;overflow:hidden;}
        .workstationShell{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto auto;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);overflow:hidden;}
        .stationViewport{min-width:0;min-height:0;overflow:hidden;}.stationContext{min-width:0;max-height:260px;overflow:auto;border-top:1px solid rgba(148,163,184,.12);}
        .statusToggle{height:28px;border:0;border-top:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.84);color:#cbd5e1;font-size:10px;font-weight:900;text-align:left;padding:0 10px;cursor:pointer;}
      `}</style>
    </main>
  );
}
