"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  toolbar?: ReactNode;
};

type Tab = "frontend" | "code" | "diff" | "logs" | "media";
type RuntimeEvent = { id?: string | number; eventType?: string; event_type?: string; message?: string | null; createdAt?: string; created_at?: string };
type ProofLine = { id: string; message: string; at: string; level: "info" | "success" | "warning" | "error" };

function normalizeRoute(value: string) {
  const route = String(value || "/").trim();
  return route.startsWith("/") ? route : `/${route}`;
}

function liveUrlFor(repo: string, route: string) {
  if (route.startsWith("/streams-builder/preview/")) return route;
  const app = (repo || "").split("/").pop() || "";
  return app ? `https://${app}.vercel.app${route}` : route;
}

function label(tab: Tab) {
  if (tab === "frontend") return "Frontend UI";
  if (tab === "code") return "Code Editor";
  if (tab === "diff") return "Diff";
  if (tab === "logs") return "Logs";
  return "Media";
}

function levelFor(value: string): ProofLine["level"] {
  const text = value.toLowerCase();
  if (/failed|blocked|error|unauthorized/.test(text)) return "error";
  if (/approval|awaiting|unproven|skipped/.test(text)) return "warning";
  if (/passed|completed|verified|ready|queued|mounted|pulled/.test(text)) return "success";
  return "info";
}

export default function LiveFrontendWorkstation({ activeFile, toolbar }: Props) {
  const route = normalizeRoute(activeFile.route || "/");
  const liveUrl = liveUrlFor(activeFile.repo, route);
  const ready = Boolean(activeFile.path && activeFile.repo);
  const [tab, setTab] = useState<Tab>("frontend");
  const [frameKey, setFrameKey] = useState(0);
  const [codeDraft, setCodeDraft] = useState(activeFile.content || "");
  const [proof, setProof] = useState<ProofLine[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const sourceLines = useMemo(() => (codeDraft || activeFile.content || "").split("\n"), [codeDraft, activeFile.content]);

  function addProof(message: string) {
    setProof((items) => [...items.slice(-79), {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      message,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level: levelFor(message),
    }]);
  }

  useEffect(() => {
    setCodeDraft(activeFile.content || "");
    if (ready) addProof(`Source mounted: ${activeFile.repo}@${activeFile.branch}:${activeFile.path}`);
  }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, activeFile.content, ready]);

  useEffect(() => {
    function onSummary(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) addProof(detail.message);
    }
    function onRuntimeJob(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      if (!detail?.jobId) return;
      addProof(`Runtime job queued: ${detail.jobId}`);
      let stopped = false;
      async function poll() {
        try {
          const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(detail.jobId || "")}`, { cache: "no-store", credentials: "same-origin" });
          const payload = await response.json().catch(() => null) as { ok?: boolean; events?: RuntimeEvent[]; error?: string } | null;
          if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Runtime proof unavailable");
          if (stopped) return;
          for (const item of payload.events || []) {
            const key = String(item.id || `${item.eventType || item.event_type}:${item.message}:${item.createdAt || item.created_at}`);
            if (seen.current.has(key)) continue;
            seen.current.add(key);
            addProof(`${item.eventType || item.event_type || "runtime"}: ${item.message || "event"}`);
          }
        } catch (error) {
          if (!stopped) addProof(error instanceof Error ? error.message : "Runtime proof unavailable");
        }
      }
      void poll();
      const timer = window.setInterval(() => void poll(), 2500);
      window.setTimeout(() => { stopped = true; window.clearInterval(timer); }, 15 * 60 * 1000);
    }
    window.addEventListener("streams-builder-summary-event", onSummary);
    window.addEventListener("streams-builder:runtime-job", onRuntimeJob);
    return () => {
      window.removeEventListener("streams-builder-summary-event", onSummary);
      window.removeEventListener("streams-builder:runtime-job", onRuntimeJob);
    };
  }, []);

  return (
    <section className="liveWorkstation" aria-label="Live frontend workstation">
      <header className="workstationToolbar">
        <nav className="workingTabs" aria-label="Workstation views">
          {(["code", "diff", "logs", "media", "frontend"] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{label(item)}</button>
          ))}
        </nav>
        <div className="sourceToolbar">{toolbar}<span className="routeValue" title={route}>Route <b>{route}</b></span><button type="button" className="refresh" onClick={() => setFrameKey((value) => value + 1)}>Refresh</button></div>
      </header>

      <main className="workstationBody">
        {tab === "frontend" ? (
          ready ? <iframe key={`${frameKey}-${liveUrl}`} title="Live frontend preview" src={liveUrl} /> : <div className="empty">Pull a real source file to open the frontend.</div>
        ) : null}
        {tab === "code" ? <RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={setCodeDraft} /> : null}
        {tab === "diff" ? <pre>{sourceLines.slice(0, 240).map((line, index) => `${String(index + 1).padStart(4, " ")}  ${line}`).join("\n") || "No source diff is available."}</pre> : null}
        {tab === "logs" ? <div className="proofList">{proof.length ? proof.map((item) => <p key={item.id} className={item.level}><span>{item.at}</span>{item.message}</p>) : <p>No runtime events yet.</p>}</div> : null}
        {tab === "media" ? <div className="empty">Media artifacts and verified browser captures will appear here.</div> : null}
      </main>

      <style jsx>{`
        .liveWorkstation{height:100%;min-height:0;display:grid;grid-template-rows:40px minmax(0,1fr);overflow:hidden;background:#020617;color:#e5e7eb}
        .workstationToolbar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;border-bottom:1px solid rgba(45,212,191,.28);background:#020617;overflow:hidden}
        .workingTabs,.sourceToolbar{min-width:0;display:flex;align-items:center;gap:4px;overflow:auto;white-space:nowrap}.sourceToolbar{justify-content:flex-end;flex:1}
        button{height:28px;border:1px solid transparent;border-radius:8px;background:transparent;color:#6ee7b7;padding:0 10px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}
        button:hover{background:rgba(15,118,110,.18)}button.active{border-color:rgba(45,212,191,.55);background:rgba(6,78,59,.64);color:#99f6e4}.refresh{border-color:rgba(148,163,184,.24);color:#fff}
        .routeValue{max-width:180px;overflow:hidden;text-overflow:ellipsis;color:#6ee7b7;font-size:9px;text-transform:uppercase}.routeValue b{color:#fff;text-transform:none;font-size:10px}
        .workstationBody{min-width:0;min-height:0;overflow:hidden;background:#020617}.workstationBody iframe{display:block;width:100%;height:100%;border:0;background:#fff}.workstationBody pre{height:100%;overflow:auto;margin:0;padding:12px;color:#dbeafe;font:11px/17px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;box-sizing:border-box}
        .empty{height:100%;display:grid;place-content:center;padding:20px;text-align:center;color:#94a3b8}.proofList{height:100%;overflow:auto;padding:10px;box-sizing:border-box;display:grid;align-content:start;gap:6px}.proofList p{margin:0;border-left:3px solid #64748b;background:#0f172a;padding:7px 9px;font-size:10px;line-height:1.4}.proofList p span{display:inline-block;width:76px;color:#94a3b8}.proofList p.success{border-left-color:#22c55e}.proofList p.warning{border-left-color:#f59e0b}.proofList p.error{border-left-color:#ef4444}
        @media(max-width:1100px){.workstationToolbar{align-items:stretch;height:auto;min-height:40px;flex-wrap:wrap;padding:5px 8px}.sourceToolbar{justify-content:flex-start}.routeValue{display:none}}
      `}</style>
    </section>
  );
}
