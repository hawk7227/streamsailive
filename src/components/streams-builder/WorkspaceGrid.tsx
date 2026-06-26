"use client";

import { useEffect, useState } from "react";
import VisualEditorPage from "../../app/visual-editor/page";
import BuilderCenterChat from "./BuilderCenterChat";
import BuilderControlLayers from "./BuilderControlLayers";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import LiveFrontendWorkstation from "./LiveFrontendWorkstation";
import TopRowWorkstationControls from "./TopRowWorkstationControls";
import VisualEditorScrollBehavior from "./VisualEditorScrollBehavior";
import WorkstationChromeEnhancer from "./WorkstationChromeEnhancer";
import WorkspaceModulePanel from "./workspace-modules/WorkspaceModulePanel";

const MODULES = [
  "Primary Builder",
  "Visual Editing",
  "Component Mapping",
  "Approval Center",
  "Browser Verification",
  "Repository Truth",
  "Projects Dashboard",
  "Truth Panel",
] as const;

type ModuleName = (typeof MODULES)[number];
type ViewMode = "Single" | "Multi" | "Focus" | "Stack";
type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };

const EMPTY_FILE: PulledFileDetail = { repo: "", branch: "", path: "", folder: "", sha: "", content: "", route: "/" };

function readActiveFile() {
  if (typeof window === "undefined") return EMPTY_FILE;
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as PulledFileDetail : EMPTY_FILE;
  } catch {
    return EMPTY_FILE;
  }
}

export default function WorkspaceGrid() {
  const [activeModule, setActiveModule] = useState<ModuleName>("Primary Builder");
  const [viewMode, setViewMode] = useState<ViewMode>("Single");
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<PulledFileDetail>(EMPTY_FILE);
  const [visualEditorLog, setVisualEditorLog] = useState<string[]>([]);

  useEffect(() => {
    setActiveFile(readActiveFile());
    function onPulledFile(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (!detail?.path) return;
      setActiveFile(detail);
      setVisualEditorLog((items) => [...items.slice(-20), `Workspace mounted ${detail.repo}@${detail.branch}:${detail.path}`]);
    }
    window.addEventListener("streams-builder:pulled-file", onPulledFile);
    return () => window.removeEventListener("streams-builder:pulled-file", onPulledFile);
  }, []);

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
          <section className="operatorColumn">
            <BuilderCenterChat />
            <BuilderControlLayers activeModule={activeModule} viewMode={viewMode} latestProof={visualEditorLog.slice(-1)[0] || ""} />
          </section>
          <section className="workstationShell">
            <div className="stationViewport">
              {activeModule === "Visual Editing" ? (
                <section className="realVisualEditorMount" aria-label="Recovered real visual editor foundation">
                  <VisualEditorPage />
                </section>
              ) : (
                <LiveFrontendWorkstation activeFile={activeFile} />
              )}
            </div>
            <div className="stationContext"><WorkspaceModulePanel moduleName={activeModule} /></div>
            <button className="statusToggle" type="button" onClick={() => setStatusOpen((value) => !value)}>{statusOpen ? "Hide" : "Show"} Status / Readiness / Files / Context</button>
            {statusOpen ? <div className="statusDrop"><p><b>Status</b><span>Agent 1 / {activeModule}</span></p><p><b>Readiness</b><span>{activeModule === "Visual Editing" ? "Recovered real /visual-editor foundation mounted. Fake overlay workstation bypassed." : visualEditorLog.slice(-1)[0] || "Pull a source file to bind this workstation."}</span></p><p><b>Files</b><span>{activeFile.path || "No active file."}</span></p><p><b>Context</b><span>{activeFile.repo ? `${activeFile.repo}@${activeFile.branch}` : "Waiting for source selection."}</span></p></div> : null}
          </section>
        </section>
      </section>
      <TopRowWorkstationControls />
      <VisualEditorScrollBehavior />
      <WorkstationChromeEnhancer />
      <style jsx>{`
        .streamsBuilderShell{width:100vw;height:100dvh;display:block;background:#020713;color:#fff;padding:0;box-sizing:border-box;overflow:auto;}
        .centerWorkspace{min-width:0;min-height:100dvh;border:0;border-radius:0;background:#020713;overflow:visible;padding:4px 4px 0;display:grid;grid-template-rows:34px minmax(calc(100dvh - 40px),auto);gap:2px;box-sizing:border-box;}
        .topRow{height:34px;min-height:34px;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.48fr);gap:12px;min-width:0;align-items:center;overflow:hidden;}
        .controls{height:34px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0;align-items:center;}
        label{min-width:0;height:28px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:end;border:0;border-radius:0;background:transparent;padding:0;border-bottom:1px solid rgba(148,163,184,.34);}
        label b,.statusDrop b{display:block;color:#6ee7b7;font-size:9px;text-transform:uppercase;margin-bottom:3px;line-height:1;}
        select{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:11px;outline:none;padding:0 0 3px;}option{color:#020617;}
        .workArea{min-width:0;min-height:calc(100dvh - 40px);display:grid;grid-template-columns:370px minmax(0,1fr);gap:6px;overflow:visible;align-items:start;}
        .operatorColumn{min-width:0;display:grid;gap:6px;align-content:start;}
        .workstationShell{min-width:0;min-height:calc(100dvh - 40px);display:grid;grid-template-rows:auto minmax(0,1fr) auto auto auto;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);overflow:visible;}
        .stationViewport{min-width:0;min-height:0;height:100%;overflow:hidden;}.realVisualEditorMount{height:100%;min-height:0;overflow:hidden;background:var(--color-background-primary,#050915);}
        .stationContext{min-width:0;max-height:none;overflow:visible;border-top:1px solid rgba(148,163,184,.12);}
        .statusToggle{height:28px;border:0;border-top:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.84);color:#cbd5e1;font-size:10px;font-weight:900;text-align:left;padding:0 10px;cursor:pointer;}
        .statusDrop{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border-top:1px solid rgba(148,163,184,.12);padding:6px;max-height:none;overflow:visible;background:rgba(2,6,23,.72);}
        .statusDrop p{min-width:0;margin:0;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(15,23,42,.72);padding:7px;}.statusDrop span{display:block;color:#cbd5e1;font-size:10px;line-height:1.35;overflow-wrap:anywhere;}
      `}</style>
    </main>
  );
}
