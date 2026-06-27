"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type Mode = "editor" | "browser" | "mobile" | "advanced";

type Action = {
  action: string;
  target: string;
  at: string;
};

type RuntimeJobDetail = { jobId: string; repo?: string; branch?: string; path?: string; route?: string; prompt?: string };
type RuntimeEvent = { id?: string | number; eventType?: string; event_type?: string; message?: string | null; createdAt?: string; created_at?: string; data?: Record<string, unknown> };
type LiveProofLine = { id: string; message: string; at: string; source: string; level: "info" | "success" | "warning" | "error" };

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

export default function LiveFrontendWorkstation({ activeFile }: Props) {
  const route = normalizeRoute(activeFile.route || "/");
  const liveUrl = liveUrlFor(activeFile.repo, route);
  const ready = Boolean(activeFile.repo && activeFile.path);
  const [mode, setMode] = useState<Mode>("browser");
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [runtimeJobId, setRuntimeJobId] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState("waiting for Codex job");
  const [liveProof, setLiveProof] = useState<LiveProofLine[]>([]);
  const seenRuntimeEventsRef = useRef<Set<string>>(new Set());
  const summaryRailRef = useRef<HTMLElement | null>(null);

  const modeLabel = mode === "editor" ? "Live Editor" : mode === "browser" ? "Click-through Browser" : mode === "mobile" ? "Mobile Preview" : "Advanced Tools";
  const sourceLines = useMemo(() => (activeFile.content || "").split("\n").slice(0, 80), [activeFile.content]);

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
    record(`switch-mode-${next}`);
  }

  function refresh() {
    setFrameKey((value) => value + 1);
    record("refresh-preview");
  }

  function saveProof() {
    setDrawerOpen(true);
    record("save-preview-proof", activeFile.path || liveUrl);
  }

  function duplicateView() {
    setFrameKey((value) => value + 1);
    setDrawerOpen(true);
    record("duplicate-preview-state", liveUrl);
  }

  function resetView() {
    setMode("browser");
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
    const rail = summaryRailRef.current;
    if (!rail) return;
    rail.scrollTop = rail.scrollHeight;
  }, [liveProof, runtimeStatus]);

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

  return (
    <section className="liveWorkstation" aria-label="Live frontend workstation preview">
      <aside ref={summaryRailRef} className="summaryRail" aria-live="polite">
        <p className="meta">Worked in Agent 1 · {activeFile.repo || "no repo selected"} · {activeFile.branch || "no branch selected"}</p>
        <h3>Live Agent Timeline</h3>
        <ul className="proofList">
          {liveProof.length ? liveProof.slice(-28).map((item) => <li key={item.id} className={item.level}><span>{item.at}</span><b>{item.source}</b>{item.message}</li>) : <li className="info">Waiting for Agent 1 to pull source or queue a Codex job.</li>}
        </ul>
        <h3>Summary</h3>
        <ul>
          <li>{ready ? `Mounted ${activeFile.path} from ${activeFile.repo}@${activeFile.branch}.` : "Pull a source file to mount the live frontend."}</li>
          <li>{ready ? "Frontend UI is the same live browser view used by Visual Editing." : "No frontend is mounted yet."}</li>
          <li>Mode: {modeLabel}</li>
          <li>Codex status: {runtimeStatus}</li>
        </ul>
        <h3>Verification</h3>
        <ul>
          <li>Verified repo: {activeFile.repo || "not selected"}</li>
          <li>Verified branch: {activeFile.branch || "not selected"}</li>
          <li>Verified file: {activeFile.path || "not selected"}</li>
          <li>Verified route: {route}</li>
          <li>Verified SHA: {activeFile.sha || "missing"}</li>
          <li>Live preview URL: {ready ? liveUrl : "waiting for Pull"}</li>
          <li>Runtime job: {runtimeJobId || "not queued yet"}</li>
        </ul>
      </aside>
      <main className="previewSide">
        <nav className="tabs"><button type="button">Summary</button><button type="button">Code</button><button type="button" className="active">Frontend UI</button><button type="button">Diff</button><button type="button">Logs</button><button type="button">Media</button></nav>
        <div className="debug"><span>repo <b>{activeFile.repo || "not selected"}</b></span><span>branch <b>{activeFile.branch || "not selected"}</b></span><span>route <b>{route}</b></span><span>file <b>{activeFile.path || "not selected"}</b></span><span>live url <b>{ready ? liveUrl : "not mounted"}</b></span></div>
        <section className={mode === "mobile" ? "phoneWrap" : "frameWrap"}>
          {ready ? <iframe key={`${frameKey}-${liveUrl}-${mode}`} title="Live frontend preview" src={liveUrl} /> : <div className="empty"><h2>Pull a source file first</h2><p>The actual frontend browser view will appear here after Pull.</p></div>}
        </section>
        <footer className="toolStrip">
          <div><span>Route</span><b>{route}</b></div>
          <div><span>Component</span><b>Live Page</b></div>
          <div><span>File</span><b>{activeFile.path || "no file"}</b></div>
          <div><span>Branch</span><b>{activeFile.branch || "no branch"}</b></div>
          <div><span>Mode</span><b>{modeLabel}</b></div>
          <button type="button" className={mode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button>
          <button type="button" className={mode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button>
          <button type="button" className={mode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button>
          <button type="button" className={mode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button>
          <button type="button" onClick={saveProof}>Save</button>
          <button type="button" onClick={duplicateView}>Dup</button>
          <button type="button" onClick={resetView}>Reset</button>
        </footer>
        <details className="toolDrawer" open={drawerOpen || mode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}>
          <summary>Proof / Source Truth / Editor</summary>
          <section className="drawerGrid">
            <article><b>Source Truth</b><p>{activeFile.repo || "No repo"}</p><p>{activeFile.branch || "No branch"}</p><p>{activeFile.path || "No file"}</p><p>{activeFile.sha || "missing sha"}</p></article>
            <article><b>Preview</b><p>{ready ? liveUrl : "Waiting for source pull"}</p><p>Browser mode is click-through.</p><p>Frame has inner scroll for full page review.</p></article>
            <article><b>Codex Runtime</b><p>{runtimeStatus}</p><p>{runtimeJobId || "No runtime job yet"}</p><p>Worker events poll every 2.5 seconds after queue.</p></article>
            <article><b>Status</b><p>{ready ? "Ready" : "Waiting"}</p><p>{modeLabel}</p></article>
            <article className="wide"><b>Source Preview</b><pre>{sourceLines.join("\n") || "No source loaded."}</pre></article>
            <article className="wide"><b>Live Proof Events</b>{liveProof.length ? liveProof.slice(-12).map((item) => <p key={item.id}>{item.at} · {item.source} · {item.message}</p>) : <p>No proof events yet.</p>}</article>
            <article className="wide"><b>Browser Actions</b>{actions.length ? actions.slice(-8).map((item) => <p key={`${item.action}-${item.at}`}>{item.action} · {item.target}</p>) : <p>No actions yet.</p>}</article>
          </section>
        </details>
      </main>
      <style jsx>{`
        .liveWorkstation{height:100%;min-height:0;display:grid;grid-template-columns:minmax(300px,.36fr) minmax(0,1fr);overflow:hidden;background:#f6f8fa;color:#24292f}.summaryRail{height:100%;overflow:auto;border-right:1px solid #d8dee4;background:#fff;padding:18px;box-sizing:border-box}.summaryRail .meta{margin:0 0 18px;color:#57606a;font-size:13px}.summaryRail h3{margin:16px 0 10px;font-size:20px}.summaryRail ul{margin:0;padding-left:20px;display:grid;gap:10px}.summaryRail li{font-size:13px;line-height:1.45}.proofList{padding-left:0!important;list-style:none}.proofList li{border-left:4px solid #94a3b8;background:#f6f8fa;border-radius:8px;padding:8px 10px}.proofList li span{display:block;color:#57606a;font-size:11px}.proofList li b{display:inline-block;margin-right:6px;color:#24292f;text-transform:uppercase;font-size:10px}.proofList li.success{border-left-color:#22c55e;background:#ecfdf5}.proofList li.warning{border-left-color:#f59e0b;background:#fffbeb}.proofList li.error{border-left-color:#ef4444;background:#fef2f2}.previewSide{min-width:0;min-height:0;display:grid;grid-template-rows:44px auto minmax(0,1fr) auto auto;overflow:hidden;background:#020617}.tabs{display:flex;min-width:0;overflow:auto;border-bottom:1px solid #d8dee4;background:#f6f8fa}.tabs button{height:44px;border:0;border-right:1px solid #d8dee4;background:transparent;color:#57606a;padding:0 20px;font-size:13px;font-weight:800}.tabs button.active{background:#fff;color:#24292f;box-shadow:inset 0 -2px 0 #fd8c73}.debug{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.45)}.debug span{min-width:0;display:block;padding:9px 12px;background:#020617;color:#94a3b8;font-size:10px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.debug b{display:block;color:#fff;text-transform:none;font-size:12px}.frameWrap{min-width:0;min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:16px;overflow:auto;background:#fff}.phoneWrap{width:430px;min-height:0;margin:10px auto;border:12px solid #111827;border-radius:34px;overflow:auto;background:#fff}.frameWrap iframe,.phoneWrap iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.empty h2{margin:0 0 8px;font-size:28px}.empty p{margin:0;color:#475569}.toolStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(7,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.toolStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.toolStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.toolStrip b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.toolStrip button{height:36px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}.toolStrip button.active{border-color:rgba(110,231,183,.7);background:rgba(6,78,59,.7);color:#6ee7b7}.toolDrawer{max-height:320px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#fff}.toolDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid article{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid b{display:block;color:#fff;margin-bottom:6px}.drawerGrid p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}.drawerGrid pre{max-height:190px;overflow:auto;margin:0;color:#cbd5e1;font:11px/16px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}.wide{grid-column:span 2}
      `}</style>
    </section>
  );
}
