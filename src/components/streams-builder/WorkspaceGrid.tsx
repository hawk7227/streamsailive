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
            <div className="stationContext"><WorkspaceModulePanel moduleName={activeModule} /></div>
            <button className="statusToggle" type="button" onClick={() => setStatusOpen((value) => !value)}>{statusOpen ? "Hide" : "Show"} Status / Readiness / Files / Context</button>
            {statusOpen ? <div className="statusDrop"><p><b>Status</b><span>Agent 1 / {activeModule}</span></p><p><b>Readiness</b><span>Existing readiness stays under the workstation.</span></p><p><b>Files</b><span>Attached to this workstation.</span></p><p><b>Context</b><span>Current single workstation context.</span></p></div> : null}
          </section>
        </section>
      </section>
      <WorkstationChromeEnhancer />
      <style jsx>{`
        .streamsBuilderShell{width:100vw;height:100dvh;display:block;background:#020713;color:#fff;padding:0;box-sizing:border-box;overflow:auto;}
        .centerWorkspace{min-width:0;min-height:100dvh;border:0;border-radius:0;background:#020713;overflow:visible;padding:6px;display:grid;grid-template-rows:auto minmax(calc(100dvh - 68px),auto);gap:6px;box-sizing:border-box;}
        .topRow{min-height:44px;display:grid;grid-template-columns:minmax(360px,1fr) minmax(460px,1fr);gap:6px;min-width:0;}
        .controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0;}
        label{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:10px;background:#020617;padding:6px;}
        label b,.statusDrop b{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;margin-bottom:3px;}
        select{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:11px;outline:none;}option{color:#020617;}
        .workArea{min-width:0;min-height:calc(100dvh - 68px);display:grid;grid-template-columns:370px minmax(0,1fr);gap:6px;overflow:visible;align-items:start;}
        .workstationShell{min-width:0;min-height:calc(100dvh - 68px);display:grid;grid-template-rows:minmax(calc(100dvh - 108px),auto) auto auto auto;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);overflow:visible;}
        .stationViewport{min-width:0;min-height:calc(100dvh - 108px);overflow:hidden;}.stationContext{min-width:0;max-height:none;overflow:visible;border-top:1px solid rgba(148,163,184,.12);}
        .statusToggle{height:28px;border:0;border-top:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.84);color:#cbd5e1;font-size:10px;font-weight:900;text-align:left;padding:0 10px;cursor:pointer;}
        .statusDrop{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border-top:1px solid rgba(148,163,184,.12);padding:6px;max-height:none;overflow:visible;background:rgba(2,6,23,.72);}
        .statusDrop p{min-width:0;margin:0;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(15,23,42,.72);padding:7px;}.statusDrop span{display:block;color:#cbd5e1;font-size:10px;line-height:1.35;overflow-wrap:anywhere;}
      `}</style>
    </main>
  );
}
