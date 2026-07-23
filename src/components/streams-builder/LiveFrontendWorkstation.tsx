"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

type PulledFileDetail = {
  repo: string;
  branch: string;
  path: string;
  folder: string;
  sha: string;
  content: string;
  route: string;
};

type Props = {
  activeFile: PulledFileDetail;
};

type Mode = "editor" | "browser" | "mobile" | "advanced" | "code" | "split";
type Tab = "frontend" | "code" | "diff" | "logs" | "media";

type Action = {
  action: string;
  target: string;
  at: string;
};

type RuntimeJobDetail = { jobId: string; repo?: string; branch?: string; path?: string; route?: string; prompt?: string };
type RuntimeEvent = { id?: string | number; eventType?: string; event_type?: string; message?: string | null; createdAt?: string; created_at?: string; data?: Record<string, unknown> };
type LiveProofLine = { id: string; message: string; at: string; source: string; level: "info" | "success" | "warning" | "error" };
type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };

function normalizeRoute(value: string) {
  const trimmed = (value || "/").trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function repoName(repo: string) {
  return (repo || "").split("/").pop() || "";
}

function liveUrlFor(repo: string, route: string) {
  const path = normalizeRoute(route);
  if (repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${path}`;
  if (repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${path}`;
  const app = repoName(repo);
  return app ? `https://${app}.vercel.app${path}` : path;
}

function eventType(event: RuntimeEvent) {
  return String(event.eventType || event.event_type || "runtime.event");
}

function eventLabel(event: RuntimeEvent) {
  const type = eventType(event);
  const message = event.message || "runtime event received";
  return `${type}: ${message}`;
}

function eventKey(event: RuntimeEvent) {
  return String(event.id || `${event.eventType || event.event_type}:${event.message || ""}:${event.createdAt || event.created_at || ""}`);
}

function eventLevel(event: RuntimeEvent): LiveProofLine["level"] {
  const text = `${eventType(event)} ${event.message || ""}`.toLowerCase();
  if (/failed|blocked|error|unauthorized/.test(text)) return "error";
  if (/skipped|unproven|approval|push_blocked|awaiting/.test(text)) return "warning";
  if (/completed|passed|verified|ready|queued|created|prepared|claimed|pulled/.test(text)) return "success";
  return "info";
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function tabLabel(tab: Tab) {
  if (tab === "frontend") return "Frontend UI";
  if (tab === "code") return "Code Editor";
  if (tab === "diff") return "Diff";
  if (tab === "logs") return "Logs";
  return "Media";
}

export default function LiveFrontendWorkstation({ activeFile }: Props) {
  const route = normalizeRoute(activeFile.route || "/");
  const liveUrl = liveUrlFor(activeFile.repo, route);
  const ready = Boolean(activeFile.repo && activeFile.path);
  const [mode, setMode] = useState<Mode>("browser");
  const [tab, setTab] = useState<Tab>("frontend");
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [runtimeJobId, setRuntimeJobId] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState("waiting for Codex job");
  const [liveProof, setLiveProof] = useState<LiveProofLine[]>([]);
  const [codeDraft, setCodeDraft] = useState(activeFile.content || "");
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const seenRuntimeEventsRef = useRef<Set<string>>(new Set());

  const modeLabel = mode === "editor" ? "Live Editor" : mode === "browser" ? "Click-through Browser" : mode === "mobile" ? "Mobile Preview" : mode === "advanced" ? "Advanced Tools" : mode === "code" ? "Code Editor" : "Code + Frontend";
  const sourceLines = useMemo(() => (codeDraft || activeFile.content || "").split("\n"), [codeDraft, activeFile.content]);
  const sidePanelOpen = tab !== "frontend" && mode !== "code" && mode !== "split";

  useEffect(() => {
    setCodeDraft(activeFile.content || "");
    setSelection(null);
  }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, activeFile.content]);

  function addProof(message: string, source = "workstation", level: LiveProofLine["level"] = "info") {
    const line = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message, at: nowTime(), source, level };
    setLiveProof((items) => [...items.slice(-44), line]);
  }

  function record(action: string, target = liveUrl) {
    setActions((items) => [...items.slice(-12), { action, target, at: new Date().toISOString() }]);
    addProof(`${action} · ${target}`, "preview", "info");
  }

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "advanced") setDrawerOpen(true);
    if (next === "mobile") setFrameKey((value) => value + 1);
    if (next === "code") setTab("code");
    if (next === "split") setTab("frontend");
    record(`switch-mode-${next}`);
  }

  function refresh() {
    setFrameKey((value) => value + 1);
    record("refresh-preview");
  }

  function saveProof() {
    setDrawerOpen(true);
    setTab("logs");
    record("save-preview-proof", activeFile.path || liveUrl);
  }

  function duplicateView() {
    setFrameKey((value) => value + 1);
    setDrawerOpen(true);
    record("duplicate-preview-state", liveUrl);
  }

  function resetView() {
    setMode("browser");
    setTab("frontend");
    setDrawerOpen(false);
    setFrameKey((value) => value + 1);
    record("reset-live-preview", liveUrl);
  }

  useEffect(() => {
    if (!ready) return;
    addProof(`Source mounted: ${activeFile.repo}@${activeFile.branch}:${activeFile.path}`, "source", "success");
    addProof(`Live preview mounted for ${route}`, "preview", "success");
  }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, route, ready]);

  useEffect(() => {
    if (!runtimeJobId) return;
    let stopped = false;

    async function pollRuntimeJob() {
      try {
        const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(runtimeJobId)}`, { cache: "no-store" });
        const json = await response.json().catch(() => null) as { ok?: boolean; job?: { status?: string; metadata?: Record<string, unknown> }; events?: RuntimeEvent[]; error?: string } | null;
        if (!response.ok || !json?.ok) throw new Error(json?.error || `Runtime events request failed: ${response.status}`);
        if (stopped) return;
        const status = json.job?.status || "running";
        setRuntimeStatus(`runtime ${status}`);
        const nextEvents = Array.isArray(json.events) ? json.events : [];
        for (const event of nextEvents) {
          const key = eventKey(event);
          if (seenRuntimeEventsRef.current.has(key)) continue;
          seenRuntimeEventsRef.current.add(key);
          addProof(eventLabel(event), "worker", eventLevel(event));
        }
        const metadata = json.job?.metadata || {};
        const reliability = metadata.bestBuilderReliability as { proofTimeline?: Array<{ state?: string; message?: string; severity?: string }> } | undefined;
        for (const item of reliability?.proofTimeline || []) {
          const key = `timeline:${item.state}:${item.message}`;
          if (seenRuntimeEventsRef.current.has(key)) continue;
          seenRuntimeEventsRef.current.add(key);
          addProof(`${item.state || "PROOF"}: ${item.message || "proof event"}`, "proof", item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : item.severity === "success" ? "success" : "info");
        }
      } catch (error) {
        if (stopped) return;
        const message = error instanceof Error ? error.message : "Runtime events unavailable";
        setRuntimeStatus(`runtime events blocked: ${message}`);
        addProof(`Runtime events blocked: ${message}`, "worker", "error");
      }
    }

    void pollRuntimeJob();
    const timer = window.setInterval(() => void pollRuntimeJob(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [runtimeJobId]);

  useEffect(() => {
    function onSummaryEvent(event: Event) {
      const detail = (event as CustomEvent<{ phase?: string; message?: string }>).detail || {};
      if (!detail.message) return;
      addProof(detail.message, detail.phase || "agent", /blocked|failed|error/i.test(detail.message) ? "error" : /queued|pulled|connected|mounted/i.test(detail.message) ? "success" : "info");
    }

    function onAgentCommand(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string; intent?: string; pulled?: PulledFileDetail }>).detail || {};
      if (detail.prompt) addProof(`Chat command received: ${detail.prompt}`, detail.intent || "chat", "info");
      if (detail.pulled?.path) addProof(`Source truth pulled: ${detail.pulled.repo}@${detail.pulled.branch}:${detail.pulled.path}`, "source", "success");
    }

    function onRuntimeJob(event: Event) {
      const detail = (event as CustomEvent<RuntimeJobDetail>).detail;
      if (!detail?.jobId) return;
      seenRuntimeEventsRef.current = new Set();
      setRuntimeJobId(detail.jobId);
      setRuntimeStatus(`runtime queued: ${detail.jobId}`);
      addProof(`Codex worker job queued: ${detail.jobId}`, "worker", "success");
      addProof("Logs are available from the Logs tab; frontend preview remains full width until the user opens a tab.", "workstation", "info");
      if (detail.route) addProof(`Preview route for verification: ${detail.route}`, "browser", "info");
    }

    window.addEventListener("streams-builder-summary-event", onSummaryEvent);
    window.addEventListener("streams-builder:agent-one-command", onAgentCommand);
    window.addEventListener("streams-builder:runtime-job", onRuntimeJob);
    return () => {
      window.removeEventListener("streams-builder-summary-event", onSummaryEvent);
      window.removeEventListener("streams-builder:agent-one-command", onAgentCommand);
      window.removeEventListener("streams-builder:runtime-job", onRuntimeJob);
    };
  }, []);

  function renderSidePanel() {
    if (tab === "code") return <RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={setCodeDraft} onSelectionChange={setSelection} />;
    if (tab === "diff") return <pre>{sourceLines.slice(0, 160).map((line, index) => `${String(index + 1).padStart(4, " ")}  ${line}`).join("\n") || "No diff yet. Generate or queue a Codex job."}</pre>;
    if (tab === "media") return <div className="sideEmpty">Media artifacts and browser screenshots will appear here when a job produces them.</div>;
    return <div className="proofList">{liveProof.length ? liveProof.slice(-32).map((item) => <p key={item.id} className={item.level}><span>{item.at}</span><b>{item.source}</b>{item.message}</p>) : <p className="info">Waiting for Agent 1 proof events.</p>}</div>;
  }

  function renderPreviewFrame(className = mode === "mobile" ? "phoneWrap" : "frameWrap") {
    return <section className={className}>{ready ? <iframe key={`${frameKey}-${liveUrl}-${mode}`} title="Live frontend preview" src={liveUrl} /> : <div className="empty"><h2>Pull a source file first</h2><p>The actual frontend browser view will appear here after Pull.</p></div>}</section>;
  }

  function renderMainContent() {
    if (mode === "code") {
      return <section className="codeOnly"><RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={setCodeDraft} onSelectionChange={setSelection} /></section>;
    }
    if (mode === "split") {
      return <section className="codePreviewSplit"><section className="codePane"><RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={setCodeDraft} onSelectionChange={setSelection} /></section><section className="previewPane"><div className="paneTitle"><b>Actual frontend preview</b><span>{ready ? liveUrl : "waiting for pull"}</span></div>{renderPreviewFrame("frameWrap embedded")}</section></section>;
    }
    return <section className={sidePanelOpen ? "content split" : "content full"}>{sidePanelOpen ? <aside className="sidePanel"><header><b>{tabLabel(tab)}</b><button type="button" onClick={() => setTab("frontend")}>Close</button></header>{renderSidePanel()}</aside> : null}{renderPreviewFrame()}</section>;
  }

  return (
    <section className="liveWorkstation" aria-label="Live frontend workstation preview">
      <main className="previewSide">
        <header className="workstationHeader">
          <nav className="topTabs" aria-label="Frontend workstation views">
            {(["code", "diff", "logs", "media", "frontend"] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                className={tab === item || (item === "code" && (mode === "code" || mode === "split")) ? "active" : ""}
                onClick={() => item === "code" ? switchMode("split") : setTab(item)}
              >
                {tabLabel(item)}
              </button>
            ))}
          </nav>
          <div className="routePill"><span>Route</span><b>{route}</b></div>
        </header>
        <div className="debug"><span>repo <b>{activeFile.repo || "not selected"}</b></span><span>branch <b>{activeFile.branch || "not selected"}</b></span><span>file <b>{activeFile.path || "not selected"}</b></span><span>live url <b>{ready ? liveUrl : "not mounted"}</b></span></div>
        {renderMainContent()}
        <footer className="toolStrip">
          <div><span>Component</span><b>Live Page</b></div>
          <div><span>File</span><b>{activeFile.path || "no file"}</b></div>
          <div><span>Branch</span><b>{activeFile.branch || "no branch"}</b></div>
          <div><span>Mode</span><b>{modeLabel}</b></div>
          <button type="button" className={mode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button>
          <button type="button" className={mode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button>
          <button type="button" className={mode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button>
          <button type="button" className={mode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button>
          <button type="button" onClick={refresh}>Refresh</button>
          <button type="button" onClick={saveProof}>Proof</button>
          <button type="button" onClick={duplicateView}>Dup</button>
          <button type="button" onClick={resetView}>Reset</button>
        </footer>
        <details className="toolDrawer" open={drawerOpen || mode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}>
          <summary>Proof / Source Truth / Editor</summary>
          <section className="drawerGrid">
            <article><b>Source Truth</b><p>{activeFile.repo || "No repo"}</p><p>{activeFile.branch || "No branch"}</p><p>{activeFile.path || "No file"}</p><p>{activeFile.sha || "missing sha"}</p></article>
            <article><b>Preview</b><p>{ready ? liveUrl : "Waiting for source pull"}</p><p>Browser mode is click-through.</p><p>Frame has inner scroll for full page review.</p></article>
            <article><b>Codex Runtime</b><p>{runtimeStatus}</p><p>{runtimeJobId || "No runtime job yet"}</p><p>Worker events poll every 2.5 seconds after queue.</p></article>
            <article><b>Status</b><p>{ready ? "Ready" : "Waiting"}</p><p>{modeLabel}</p><p>{selection ? `Selected lines ${selection.startLine}-${selection.endLine}` : "No code selection"}</p></article>
            <article className="wide"><b>Live Proof Events</b>{liveProof.length ? liveProof.slice(-12).map((item) => <p key={item.id}>{item.at} · {item.source} · {item.message}</p>) : <p>No proof events yet.</p>}</article>
            <article className="wide"><b>Browser Actions</b>{actions.length ? actions.slice(-8).map((item) => <p key={`${item.action}-${item.at}`}>{item.action} · {item.target}</p>) : <p>No actions yet.</p>}</article>
          </section>
        </details>
      </main>
      <style jsx>{`
        .liveWorkstation{height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);overflow:hidden;background:#020617;color:#24292f}.previewSide{min-width:0;min-height:0;display:grid;grid-template-rows:36px auto minmax(0,1fr) auto auto;overflow:hidden;background:#020617}.workstationHeader{min-width:0;height:36px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;border-bottom:1px solid rgba(20,184,166,.28);background:#020617}.topTabs{min-width:0;display:flex;align-items:center;gap:4px;overflow:auto}.topTabs button{height:28px;border:1px solid transparent;border-radius:8px;background:transparent;color:#6ee7b7;padding:0 10px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}.topTabs button:hover{background:rgba(15,118,110,.18)}.topTabs button.active{border-color:rgba(45,212,191,.55);background:rgba(6,78,59,.64);color:#99f6e4}.routePill{min-width:120px;max-width:260px;display:flex;align-items:center;justify-content:flex-end;gap:7px;border-left:1px solid rgba(148,163,184,.18);padding-left:10px;overflow:hidden}.routePill span{color:#6ee7b7;font-size:9px;font-weight:900;text-transform:uppercase}.routePill b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:11px}.debug{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.45)}.debug span{min-width:0;display:block;padding:7px 10px;background:#020617;color:#94a3b8;font-size:9px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.debug b{display:block;color:#fff;text-transform:none;font-size:11px}.content{min-width:0;min-height:0;overflow:hidden;background:#020617}.content.full{display:grid;grid-template-columns:minmax(0,1fr)}.content.split{display:grid;grid-template-columns:minmax(520px,0.85fr) minmax(520px,1fr);gap:8px;padding:8px;box-sizing:border-box}.sidePanel{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(148,163,184,.22);border-radius:14px;background:#0f172a;color:#cbd5e1}.sidePanel header{height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px;border-bottom:1px solid rgba(148,163,184,.18)}.sidePanel header b{color:#fff;font-size:12px}.sidePanel header button{height:26px;border:1px solid rgba(148,163,184,.24);border-radius:8px;background:#020617;color:#fff;font-size:10px;font-weight:900;cursor:pointer}.sidePanel pre{min-height:0;overflow:auto;margin:0;padding:12px;font:11px/17px ui-monospace,SFMono-Regular,Consolas,monospace;color:#dbeafe;white-space:pre-wrap}.sideEmpty{padding:14px;color:#cbd5e1;font-size:12px;line-height:1.4}.proofList{min-height:0;overflow:auto;padding:10px;display:grid;gap:8px}.proofList p{margin:0;border-left:4px solid #64748b;border-radius:8px;background:#020617;padding:8px;color:#cbd5e1;font-size:11px;line-height:1.35}.proofList p span{display:block;color:#94a3b8;font-size:10px}.proofList p b{display:inline-block;margin-right:6px;color:#fff;text-transform:uppercase;font-size:9px}.proofList p.success{border-left-color:#22c55e;background:#052e1a}.proofList p.warning{border-left-color:#f59e0b;background:#3b2504}.proofList p.error{border-left-color:#ef4444;background:#3b0b0b}.frameWrap{min-width:0;min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:16px;overflow:auto;background:#fff}.content.split .frameWrap,.frameWrap.embedded{margin:0}.phoneWrap{width:430px;min-height:0;margin:10px auto;border:12px solid #111827;border-radius:34px;overflow:auto;background:#fff}.frameWrap iframe,.phoneWrap iframe{display:block;width:100%;height:2200px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.empty h2{margin:0 0 8px;font-size:28px}.empty p{margin:0;color:#475569}.codeOnly{min-width:0;min-height:0;overflow:hidden;padding:8px;background:#020617}.codePreviewSplit{min-width:0;min-height:0;display:grid;grid-template-columns:minmax(520px,.95fr) minmax(520px,1fr);gap:10px;padding:10px;background:#020617;overflow:hidden}.codePane,.previewPane{min-width:0;min-height:0;display:grid;overflow:hidden}.previewPane{grid-template-rows:auto minmax(0,1fr);border:1px solid rgba(124,58,237,.45);border-radius:14px;background:#020617}.paneTitle{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;font-size:11px}.paneTitle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93c5fd}.toolStrip{display:grid;grid-template-columns:repeat(4,minmax(84px,1fr)) repeat(8,auto);gap:5px;align-items:center;padding:5px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.toolStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:9px;background:rgba(8,47,73,.34);padding:5px 7px}.toolStrip span{display:block;color:#6ee7b7;font-size:9px;text-transform:uppercase;font-weight:900}.toolStrip b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:10px}.toolStrip button{height:30px;border:1px solid rgba(148,163,184,.18);border-radius:8px;background:#7c3aed;color:#fff;padding:0 8px;font-size:10px;font-weight:900;cursor:pointer}.toolStrip button.active{border-color:rgba(110,231,183,.7);background:rgba(6,78,59,.7);color:#6ee7b7}.toolDrawer{max-height:320px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#fff}.toolDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid article{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid b{display:block;color:#fff;margin-bottom:6px}.drawerGrid p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}.wide{grid-column:span 2}@media(max-width:1180px){.codePreviewSplit,.content.split{grid-template-columns:minmax(0,1fr)}.codePane{min-height:520px}.previewPane{min-height:520px}.toolStrip{grid-template-columns:repeat(2,minmax(0,1fr));}.debug{grid-template-columns:repeat(2,minmax(0,1fr));}.routePill{min-width:90px}.topTabs button{padding:0 8px}}
      `}</style>
    </section>
  );
}
