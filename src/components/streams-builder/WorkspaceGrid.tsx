"use client";

import { useEffect, useRef, useState } from "react";
import BuilderCenterChat from "./BuilderCenterChat";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import LiveFrontendWorkstation from "./LiveFrontendWorkstation";
import VisualEditingWorkstation from "./VisualEditingWorkstation";
import VisualEditorScrollBehavior from "./VisualEditorScrollBehavior";
import type { BuilderChatConnection, PulledFileDetail } from "./builderSystemContract";

const MODULES = ["Primary Builder", "Visual Editing", "Component Mapping", "Approval Center", "Browser Verification", "Repository Truth", "Projects Dashboard", "Truth Panel"] as const;
type ModuleName = (typeof MODULES)[number];
type ViewMode = "Single" | "Multi" | "Focus" | "Stack";
type StoredMessage = { role?: string; status?: string; metadata?: Record<string, unknown> };
const EMPTY_FILE: PulledFileDetail = { repo: "", branch: "", path: "", folder: "", sha: "", content: "", route: "/" };
const EMPTY_CONNECTION: BuilderChatConnection = { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1" };

function readActiveFile() { try { const raw = window.localStorage.getItem("streams-builder:active-file"); return raw ? JSON.parse(raw) as PulledFileDetail : EMPTY_FILE; } catch { return EMPTY_FILE; } }
function compact(value: string) { return String(value || "").replace(/\s+/g, " ").trim(); }
function controlName(element: HTMLElement) { return compact(element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || element.id || element.tagName.toLowerCase()).slice(0, 120); }
function fieldName(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { const label = element.closest("label")?.querySelector("b")?.textContent || element.closest("label")?.textContent || ""; const placeholder = element instanceof HTMLSelectElement ? "" : element.placeholder; return compact(element.getAttribute("aria-label") || element.name || element.id || label || placeholder || element.tagName.toLowerCase()).slice(0, 120); }
function safeFieldValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { if (element instanceof HTMLSelectElement) return compact(element.value).slice(0, 120); if (element instanceof HTMLTextAreaElement) return `${element.value.length} chars`; if (element.type === "password") return "[redacted]"; if (element.type === "file") return `${element.files?.length || 0} file(s)`; return compact(element.value).slice(0, 120) || `${element.value.length} chars`; }
function previewIdFromUrl(value: string) { return value.match(/\/streams-builder\/preview\/([0-9a-f-]{36})/i)?.[1] || ""; }
function queryValue(name: string) { try { return new URLSearchParams(window.location.search).get(name) || ""; } catch { return ""; } }

export default function WorkspaceGrid() {
  const [activeModule, setActiveModule] = useState<ModuleName>("Primary Builder");
  const [viewMode, setViewMode] = useState<ViewMode>("Single");
  const [activeFile, setActiveFile] = useState<PulledFileDetail>(EMPTY_FILE);
  const [visualEditorLog, setVisualEditorLog] = useState<string[]>([]);
  const [chatConnection, setChatConnection] = useState<BuilderChatConnection>(EMPTY_CONNECTION);
  const [hydrated, setHydrated] = useState(false);
  const lastManualEventRef = useRef("");
  const inputTimerRef = useRef<number | null>(null);
  const chatConnectionRef = useRef<BuilderChatConnection>(EMPTY_CONNECTION);
  const previewLookupRunningRef = useRef(false);
  const lastMountedPreviewRef = useRef("");

  function emit(phase: string, message: string, extra: Record<string, unknown> = {}) {
    const detail = { source: "workspace-grid", repo: activeFile.repo, branch: activeFile.branch, filePath: activeFile.path, route: activeFile.route, activeModule, viewMode, at: new Date().toISOString(), phase, message, ...extra };
    const key = `${phase}:${message}`;
    if (key === lastManualEventRef.current) return;
    lastManualEventRef.current = key;
    setVisualEditorLog((items) => [...items.slice(-40), `${phase}: ${message}`]);
    window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail }));
    window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail }));
  }

  function handleContentChange(next: string) {
    setActiveFile((current) => ({ ...current, content: next }));
    emit("workspace-content-change", `Active file draft changed manually in ${activeFile.path || "the open file"}.`, { draftDirty: true, saved: false, patchState: "not_generated" });
  }

  async function hydratePreview(previewId: string, previewUrl: string, operationId = previewId) {
    if (!previewId || !previewUrl) return;
    let source = "";
    try {
      const response = await fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null) as { preview?: { source_code?: string; preview_html?: string } } | null;
      source = String(payload?.preview?.source_code || payload?.preview?.preview_html || "");
    } catch {}
    const mounted: PulledFileDetail = { repo: "hawk7227/streamsailive", branch: "runtime-preview", path: `generated/previews/${previewId}.html`, folder: "generated/previews", sha: operationId, content: source, route: previewUrl };
    lastMountedPreviewRef.current = previewUrl;
    window.localStorage.setItem("streams-builder:active-file", JSON.stringify(mounted));
    setActiveFile(mounted);
    setActiveModule("Primary Builder");
    setViewMode("Single");
    setVisualEditorLog((items) => [...items.slice(-40), `preview-mounted: ${previewUrl}`]);
    window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: mounted }));
    window.dispatchEvent(new CustomEvent("streams-builder:preview-mounted", { detail: { previewId, previewUrl, operationId, targetPane: "builder-three-column-canvas" } }));
  }

  async function mountLatestGeneratedPreview() {
    if (previewLookupRunningRef.current) return;
    const sessionId = chatConnectionRef.current.sessionId;
    if (!sessionId || sessionId === "agent-1") return;
    previewLookupRunningRef.current = true;
    try {
      const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null) as { ok?: boolean; messages?: StoredMessage[] } | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.messages)) return;
      const completed = [...payload.messages].reverse().find((message) => {
        const previewUrl = String(message.metadata?.previewUrl || message.metadata?.preview_url || "");
        return message.role === "assistant" && message.status === "complete" && Boolean(previewUrl);
      });
      const previewUrl = String(completed?.metadata?.previewUrl || completed?.metadata?.preview_url || "");
      if (!previewUrl || previewUrl === lastMountedPreviewRef.current) return;
      const previewId = String(completed?.metadata?.previewId || completed?.metadata?.preview_id || previewIdFromUrl(previewUrl));
      const operationId = String(completed?.metadata?.operationId || completed?.metadata?.operation_id || previewId || "generated-preview");
      await hydratePreview(previewId, previewUrl, operationId);
    } finally { previewLookupRunningRef.current = false; }
  }

  useEffect(() => { chatConnectionRef.current = chatConnection; }, [chatConnection]);

  useEffect(() => {
    const sessionId = queryValue("sessionId");
    const previewId = queryValue("previewId");
    const initial = readActiveFile();
    setActiveFile(initial);
    if (sessionId) setChatConnection({ connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId });
    setHydrated(true);
    if (previewId) void hydratePreview(previewId, `/streams-builder/preview/${previewId}`, initial.sha || previewId);
    emit("workspace-audit-ready", "Permanent three-column Builder canvas mounted.");

    function onPulledFile(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (!detail?.path) return;
      setActiveFile(detail);
      const message = `Workspace mounted ${detail.repo}@${detail.branch}:${detail.path}`;
      setVisualEditorLog((items) => [...items.slice(-40), `file-loaded: ${message}`]);
      window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail: { phase: "file-loaded", source: "workspace-grid", repo: detail.repo, branch: detail.branch, filePath: detail.path, route: detail.route, message } }));
    }
    function onSummaryEvent(event: Event) {
      const detail = (event as CustomEvent<{ phase?: string; message?: string }>).detail;
      if (!detail?.message) return;
      setVisualEditorLog((items) => [...items.slice(-40), `${detail.phase || "summary"}: ${detail.message}`]);
      if (detail.phase === "chat.response.complete") window.setTimeout(() => void mountLatestGeneratedPreview(), 150);
    }
    function onManualClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("iframe")) return;
      const control = target.closest<HTMLElement>("button,a,summary,[role='button'],[data-clickable='true']");
      if (!control || !document.querySelector(".streamsBuilderShell")?.contains(control)) return;
      emit("manual-workspace-click", `User clicked ${control.tagName.toLowerCase()}: ${controlName(control)}.`);
    }
    function onManualChange(event: Event) {
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      if (!document.querySelector(".streamsBuilderShell")?.contains(target)) return;
      emit("manual-workspace-change", `User changed ${fieldName(target)} to ${safeFieldValue(target)}.`);
    }
    function onManualInput(event: Event) {
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (!document.querySelector(".streamsBuilderShell")?.contains(target)) return;
      if (inputTimerRef.current) window.clearTimeout(inputTimerRef.current);
      inputTimerRef.current = window.setTimeout(() => emit("manual-workspace-input", `User typed in ${fieldName(target)} (${safeFieldValue(target)}).`), 900);
    }

    window.addEventListener("streams-builder:pulled-file", onPulledFile);
    window.addEventListener("streams-builder-summary-event", onSummaryEvent);
    document.addEventListener("click", onManualClick);
    document.addEventListener("change", onManualChange);
    document.addEventListener("input", onManualInput);
    return () => {
      window.removeEventListener("streams-builder:pulled-file", onPulledFile);
      window.removeEventListener("streams-builder-summary-event", onSummaryEvent);
      document.removeEventListener("click", onManualClick);
      document.removeEventListener("change", onManualChange);
      document.removeEventListener("input", onManualInput);
      if (inputTimerRef.current) window.clearTimeout(inputTimerRef.current);
    };
  }, []);

  if (!hydrated) return <main className="streamsBuilderShell" aria-hidden="true" />;

  return (
    <main className="streamsBuilderShell" data-layout="permanent-three-column">
      <section className="workArea">
        <section className="operatorColumn" aria-label="Authoritative conversation">
          <BuilderCenterChat activeModule={activeModule} connection={chatConnection} onConnectionChange={setChatConnection} />
        </section>

        <section className="centerColumn" aria-label="Code editor and frontend builder">
          <LiveFrontendWorkstation activeFile={activeFile} onContentChange={handleContentChange} />
          <div className="builderBottomControls">
            <GitHubRepositoryPicker />
            <div className="controls">
              <label><b>Workspace</b><select value={activeModule} onChange={(event) => { const next = event.currentTarget.value as ModuleName; setActiveModule(next); emit("workspace-selection", `User switched workstation to ${next}.`); }}>{MODULES.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <label><b>View</b><select value={viewMode} onChange={(event) => { const next = event.currentTarget.value as ViewMode; setViewMode(next); emit("workspace-selection", `User changed workspace view mode to ${next}.`); }}><option value="Single">Single</option><option value="Multi">Multi</option><option value="Focus">Focus</option><option value="Stack">Stack</option></select></label>
            </div>
          </div>
        </section>

        <section className="visualColumn" aria-label="Original visual editor">
          <VisualEditingWorkstation stationLabel="Visual Editor" route={activeFile.route || "/"} filePath={activeFile.path} repo={activeFile.repo} branch={activeFile.branch} content={activeFile.content} onContentChange={handleContentChange} onProof={(message) => setVisualEditorLog((items) => [...items.slice(-40), message])} onChat={(message) => setVisualEditorLog((items) => [...items.slice(-40), message])} />
        </section>
      </section>
      <VisualEditorScrollBehavior />
      <style jsx>{`
        .streamsBuilderShell{height:100%;min-height:0;overflow:hidden;background:#020713;color:#f8fafc}
        .workArea{height:100%;min-height:0;display:grid;grid-template-columns:minmax(320px,.72fr) minmax(0,1fr) minmax(0,1fr);gap:1px;background:#172033;overflow:hidden}
        .operatorColumn,.centerColumn,.visualColumn{min-width:0;min-height:0;overflow:hidden;background:#020713}
        .centerColumn{display:grid;grid-template-rows:minmax(0,1fr) auto}
        .builderBottomControls{min-width:0;min-height:48px;display:grid;grid-template-columns:minmax(0,1fr) 260px;align-items:center;gap:8px;padding:5px 8px;border-top:1px solid rgba(45,212,191,.28);background:#020617;overflow:hidden}
        .controls{min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.controls label{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:5px}.controls b{font-size:9px;color:#94a3b8}.controls select{min-width:0;height:30px;border:1px solid rgba(148,163,184,.24);border-radius:7px;background:#071124;color:#e2e8f0;font-size:11px;padding:0 5px}
        :global(.centerColumn .liveWorkstation){grid-template-rows:minmax(0,1fr) auto!important}
        :global(.centerColumn .workstationToolbar){grid-row:2!important;border-top:1px solid rgba(45,212,191,.28)!important;border-bottom:0!important}
        :global(.centerColumn .workstationBody){grid-row:1!important}
        :global(.centerColumn .workingTabs){order:2!important}
        :global(.centerColumn .sourceToolbar){order:1!important}
        @media(max-width:1180px){.workArea{grid-template-columns:minmax(290px,.7fr) minmax(0,1fr) minmax(0,.9fr)}.builderBottomControls{grid-template-columns:minmax(0,1fr) 230px}}
        @media(max-width:820px){.workArea{grid-template-columns:minmax(0,1fr)}.operatorColumn{display:none}.visualColumn{display:none}.builderBottomControls{grid-template-columns:minmax(0,1fr);gap:5px}.controls{display:none}}
      `}</style>
    </main>
  );
}
