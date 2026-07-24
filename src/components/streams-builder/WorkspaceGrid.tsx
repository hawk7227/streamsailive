"use client";

import { useEffect, useRef, useState } from "react";
import BuilderCenterChat from "./BuilderCenterChat";
import BuilderControlLayers from "./BuilderControlLayers";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import LiveFrontendWorkstation from "./LiveFrontendWorkstation";
import TopRowWorkstationControls from "./TopRowWorkstationControls";
import VisualEditingWorkstation from "./VisualEditingWorkstation";
import VisualEditorScrollBehavior from "./VisualEditorScrollBehavior";
import VisualOperationDock from "./VisualOperationDock";
import WorkstationChromeEnhancer from "./WorkstationChromeEnhancer";
import WorkspaceModulePanel from "./workspace-modules/WorkspaceModulePanel";
import type { BuilderChatConnection, PulledFileDetail } from "./builderSystemContract";

const MODULES = ["Primary Builder", "Visual Editing", "Component Mapping", "Approval Center", "Browser Verification", "Repository Truth", "Projects Dashboard", "Truth Panel"] as const;
type ModuleName = (typeof MODULES)[number];
type ViewMode = "Single" | "Multi" | "Focus" | "Stack";
const EMPTY_FILE: PulledFileDetail = { repo: "", branch: "", path: "", folder: "", sha: "", content: "", route: "/" };
const EMPTY_CONNECTION: BuilderChatConnection = { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1" };

function readActiveFile() { try { const raw = window.localStorage.getItem("streams-builder:active-file"); return raw ? JSON.parse(raw) as PulledFileDetail : EMPTY_FILE; } catch { return EMPTY_FILE; } }
function compact(value: string) { return String(value || "").replace(/\s+/g, " ").trim(); }
function controlName(element: HTMLElement) { return compact(element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || element.id || element.tagName.toLowerCase()).slice(0, 120); }
function fieldName(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { const label = element.closest("label")?.querySelector("b")?.textContent || element.closest("label")?.textContent || ""; const placeholder = element instanceof HTMLSelectElement ? "" : element.placeholder; return compact(element.getAttribute("aria-label") || element.name || element.id || label || placeholder || element.tagName.toLowerCase()).slice(0, 120); }
function safeFieldValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { if (element instanceof HTMLSelectElement) return compact(element.value).slice(0, 120); if (element instanceof HTMLTextAreaElement) return `${element.value.length} chars`; if (element.type === "password") return "[redacted]"; if (element.type === "file") return `${element.files?.length || 0} file(s)`; return compact(element.value).slice(0, 120) || `${element.value.length} chars`; }

export default function WorkspaceGrid() {
  const [activeModule, setActiveModule] = useState<ModuleName>("Primary Builder");
  const [viewMode, setViewMode] = useState<ViewMode>("Single");
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<PulledFileDetail>(EMPTY_FILE);
  const [visualEditorLog, setVisualEditorLog] = useState<string[]>([]);
  const [chatConnection, setChatConnection] = useState<BuilderChatConnection>(EMPTY_CONNECTION);
  const [hydrated, setHydrated] = useState(false);
  const lastManualEventRef = useRef("");
  const inputTimerRef = useRef<number | null>(null);

  function emit(phase: string, message: string, extra: Record<string, unknown> = {}) {
    const detail = { source: "workspace-grid", repo: activeFile.repo, branch: activeFile.branch, filePath: activeFile.path, route: activeFile.route, activeModule, viewMode, at: new Date().toISOString(), phase, message, ...extra };
    const key = `${phase}:${message}`;
    if (key === lastManualEventRef.current) return;
    lastManualEventRef.current = key;
    setVisualEditorLog((items) => [...items.slice(-40), `${phase}: ${message}`]);
    window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail }));
    window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail }));
  }

  function handleContentChange(next: string) { setActiveFile((current) => ({ ...current, content: next })); emit("workspace-content-change", `Active file draft changed manually in ${activeFile.path || "the open file"}.`, { draftDirty: true, saved: false, patchState: "not_generated" }); }

  useEffect(() => {
    setActiveFile(readActiveFile());
    setHydrated(true);
    emit("workspace-audit-ready", "Workspace audit bridge is tracking manual selections, options, clicks, inputs, file pulls, editor changes, preview actions, save/patch/push states, and chat connection actions.");
    function onPulledFile(event: Event) { const detail = (event as CustomEvent<PulledFileDetail>).detail; if (!detail?.path) return; setActiveFile(detail); const message = `Workspace mounted ${detail.repo}@${detail.branch}:${detail.path}`; setVisualEditorLog((items) => [...items.slice(-40), `file-loaded: ${message}`]); window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail: { phase: "file-loaded", source: "workspace-grid", repo: detail.repo, branch: detail.branch, filePath: detail.path, route: detail.route, message } })); }
    function onSummaryEvent(event: Event) { const detail = (event as CustomEvent<{ phase?: string; message?: string }>).detail; if (!detail?.message) return; setVisualEditorLog((items) => [...items.slice(-40), `${detail.phase || "summary"}: ${detail.message}`]); }
    function onManualClick(event: MouseEvent) { const target = event.target as HTMLElement | null; if (!target || target.closest("iframe")) return; const control = target.closest<HTMLElement>("button,a,summary,[role='button'],[data-clickable='true']"); if (!control || !document.querySelector(".streamsBuilderShell")?.contains(control)) return; emit("manual-workspace-click", `User clicked ${control.tagName.toLowerCase()}: ${controlName(control)}.`); }
    function onManualChange(event: Event) { const target = event.target as HTMLElement | null; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return; if (target.closest(".controls")) return; if (!document.querySelector(".streamsBuilderShell")?.contains(target)) return; emit("manual-workspace-change", `User changed ${fieldName(target)} to ${safeFieldValue(target)}.`); }
    function onManualInput(event: Event) { const target = event.target as HTMLElement | null; if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return; if (target.closest(".controls")) return; if (!document.querySelector(".streamsBuilderShell")?.contains(target)) return; if (inputTimerRef.current) window.clearTimeout(inputTimerRef.current); inputTimerRef.current = window.setTimeout(() => emit("manual-workspace-input", `User typed in ${fieldName(target)} (${safeFieldValue(target)}).`), 900); }
    window.addEventListener("streams-builder:pulled-file", onPulledFile); window.addEventListener("streams-builder-summary-event", onSummaryEvent); document.addEventListener("click", onManualClick); document.addEventListener("change", onManualChange); document.addEventListener("input", onManualInput);
    return () => { window.removeEventListener("streams-builder:pulled-file", onPulledFile); window.removeEventListener("streams-builder-summary-event", onSummaryEvent); document.removeEventListener("click", onManualClick); document.removeEventListener("change", onManualChange); document.removeEventListener("input", onManualInput); if (inputTimerRef.current) window.clearTimeout(inputTimerRef.current); };
  }, []);

  if (!hydrated) return <main className="streamsBuilderShell" aria-hidden="true" />;

  const connectedHere = chatConnection.connected && chatConnection.activeWorkstationName === activeModule;
  return (
    <main className="streamsBuilderShell">
      <section className="centerWorkspace">
        <div className="topRow"><GitHubRepositoryPicker /><div className="controls"><label><b>Workstation</b><select value={activeModule} onChange={(event) => { const next = event.currentTarget.value as ModuleName; setActiveModule(next); emit("workspace-selection", `User switched workstation to ${next}.`); }}>{MODULES.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label><b>View Mode</b><select value={viewMode} onChange={(event) => { const next = event.currentTarget.value as ViewMode; setViewMode(next); emit("workspace-selection", `User changed workspace view mode to ${next}.`); }}><option value="Single">Single</option><option value="Multi">Multi</option><option value="Focus">Focus</option><option value="Stack">Stack</option></select></label></div></div>
        <section className="workArea">
          <section className="operatorColumn"><BuilderCenterChat activeModule={activeModule} connection={chatConnection} onConnectionChange={setChatConnection} /><BuilderControlLayers activeModule={activeModule} viewMode={viewMode} latestProof={visualEditorLog.slice(-1)[0] || ""} activeFile={activeFile} connection={chatConnection} summaryItems={visualEditorLog} /></section>
          <section className={connectedHere ? "workstationShell connected" : "workstationShell"}><div className="connectionRibbon">{chatConnection.connected ? (connectedHere ? `iPhone chat connected to ${activeModule}` : `iPhone chat connected to ${chatConnection.activeWorkstationName}. Switch connection before controlling ${activeModule}.`) : "iPhone chat is standalone. Connect it to one workstation when needed."}</div><div className="stationViewport">{activeModule === "Visual Editing" ? <VisualEditingWorkstation stationLabel="Agent 1" route={activeFile.route || "/"} filePath={activeFile.path} repo={activeFile.repo} branch={activeFile.branch} content={activeFile.content} onContentChange={handleContentChange} onProof={(message) => setVisualEditorLog((items) => [...items.slice(-40), message])} onChat={(message) => setVisualEditorLog((items) => [...items.slice(-40), message])} /> : <LiveFrontendWorkstation activeFile={activeFile} />}</div><div className="stationContext">{activeModule === "Visual Editing" ? <VisualOperationDock activeFile={activeFile} onContentChange={handleContentChange} onProof={(message) => setVisualEditorLog((items) => [...items.slice(-40), message])} /> : <WorkspaceModulePanel moduleName={activeModule} />}</div><button className="statusToggle" type="button" onClick={() => { const next = !statusOpen; setStatusOpen(next); emit("workspace-toggle", `${next ? "Opened" : "Closed"} Status / Readiness / Files / Context panel.`); }}>{statusOpen ? "Hide" : "Show"} Status / Readiness / Files / Context</button>{statusOpen ? <div className="statusDrop"><p><b>Status</b><span>Agent 1 / {activeModule}</span></p><p><b>Readiness</b><span>{activeModule === "Visual Editing" ? "Original visual editor workstation restored." : visualEditorLog.slice(-1)[0] || "Pull a source file to bind this workstation."}</span></p><p><b>Files</b><span>{activeFile.path || "No active file."}</span></p><p><b>Chat Link</b><span>{chatConnection.connected ? `${chatConnection.activeWorkstationName} only` : "Standalone / disconnected"}</span></p></div> : null}</section>
        </section>
      </section>
      <TopRowWorkstationControls /><VisualEditorScrollBehavior /><WorkstationChromeEnhancer />
    </main>
  );
}
