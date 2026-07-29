"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import BrowserDevTools from "./BrowserDevTools";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type Props = { activeFile: PulledFileDetail; toolbar?: ReactNode; onContentChange?: (content: string) => void };
type Tab = "frontend" | "code" | "diff" | "logs" | "media" | "devtools";
type PreviewLifecycleState = "idle" | "opening" | "loading-source" | "generating" | "compiling" | "ready" | "refreshing" | "stale" | "failed" | "disconnected" | "blocked-from-embedding";
type RuntimeEvent = {
  id?: string | number; eventType?: string; event_type?: string; message?: string | null; createdAt?: string; created_at?: string;
  path?: string; filePath?: string; file_path?: string; content?: string; after?: string; fullContent?: string; full_content?: string;
  startLine?: number; start_line?: number; endLine?: number; end_line?: number; patch?: string;
  data?: Record<string, unknown>; payload?: Record<string, unknown>;
};
type ProofLine = { id: string; message: string; at: string; level: "info" | "success" | "warning" | "error" };
type PatchFrame = { path: string; content: string; startLine: number; endLine: number; label: string };

function normalizeRoute(value: string) {
  const route = String(value || "/").trim();
  return route.startsWith("/") ? route : `/${route}`;
}

function isBrainstormPreview(route: string) {
  return /^\/streams-builder\/preview\/[^/]+/.test(route);
}

function liveUrlFor(repo: string, route: string) {
  if (isBrainstormPreview(route)) return route;
  const app = (repo || "").split("/").pop() || "";
  return app ? `https://${app}.vercel.app${route}` : route;
}

function label(tab: Tab) {
  return tab === "frontend" ? "Frontend UI" : tab === "code" ? "Code Editor" : tab === "diff" ? "Diff" : tab === "logs" ? "Logs" : tab === "media" ? "Media" : "DevTools";
}

function levelFor(value: string): ProofLine["level"] {
  const text = value.toLowerCase();
  if (/failed|blocked|error|unauthorized/.test(text)) return "error";
  if (/approval|awaiting|unproven|skipped/.test(text)) return "warning";
  if (/passed|completed|verified|ready|queued|mounted|pulled|applied/.test(text)) return "success";
  return "info";
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return 1;
}

function stringValue(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.length) return value;
  return "";
}

function eventFrame(event: RuntimeEvent, fallbackPath: string): PatchFrame | null {
  const data = { ...(event.payload || {}), ...(event.data || {}) } as Record<string, unknown>;
  const content = stringValue(event.fullContent, event.full_content, event.after, event.content, data.fullContent, data.full_content, data.after, data.content);
  if (!content) return null;
  const path = stringValue(event.path, event.filePath, event.file_path, data.path, data.filePath, data.file_path, fallbackPath);
  const startLine = numberValue(event.startLine, event.start_line, data.startLine, data.start_line);
  const endLine = numberValue(event.endLine, event.end_line, data.endLine, data.end_line, startLine);
  return { path, content, startLine, endLine: Math.max(startLine, endLine), label: stringValue(event.message, data.message, "Worker patch") };
}

export default function LiveFrontendWorkstation({ activeFile, toolbar, onContentChange }: Props) {
  const route = normalizeRoute(activeFile.route || "/");
  const brainstormPreview = isBrainstormPreview(route);
  const sourceLiveUrl = liveUrlFor(activeFile.repo, route);
  const ready = brainstormPreview || Boolean(activeFile.repo && activeFile.path);
  const [tab, setTab] = useState<Tab>("frontend");
  const [frameKey, setFrameKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLifecycle, setPreviewLifecycle] = useState<PreviewLifecycleState>(ready ? "ready" : "idle");
  const [previewStatus, setPreviewStatus] = useState("");
  const [codeDraft, setCodeDraft] = useState(activeFile.content || "");
  const [baseline, setBaseline] = useState(activeFile.content || "");
  const [proof, setProof] = useState<ProofLine[]>([]);
  const [highlightRange, setHighlightRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [patchState, setPatchState] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const animationToken = useRef(0);
  const draftRef = useRef(codeDraft);
  const lastPreviewActionRef = useRef("");
  const liveUrl = previewUrl || sourceLiveUrl;

  function addProof(message: string) {
    setProof((items) => [...items.slice(-79), {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      message,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level: levelFor(message),
    }]);
  }

  function setDraft(next: string) {
    draftRef.current = next;
    setCodeDraft(next);
    onContentChange?.(next);
  }

  async function animatePatch(frame: PatchFrame) {
    if (frame.path && activeFile.path && frame.path !== activeFile.path) {
      addProof(`Patch blocked: worker targeted ${frame.path}, visible lock is ${activeFile.path}.`);
      return;
    }
    const token = ++animationToken.current;
    const beforeLines = draftRef.current.split("\n");
    const afterLines = frame.content.split("\n");
    const max = Math.max(beforeLines.length, afterLines.length);
    const changed: number[] = [];
    for (let index = 0; index < max; index += 1) if (beforeLines[index] !== afterLines[index]) changed.push(index + 1);
    if (!changed.length) return;

    setTab("code");
    setPatchState(`AI editing ${frame.path || activeFile.path} · ${changed.length} line${changed.length === 1 ? "" : "s"}`);
    addProof(`${frame.label}: applying ${changed.length} changed line${changed.length === 1 ? "" : "s"}.`);
    const working = beforeLines.slice();

    for (const line of changed) {
      if (token !== animationToken.current) return;
      const index = line - 1;
      if (index >= afterLines.length) working.splice(index, 1);
      else if (index >= working.length) working.push(afterLines[index]);
      else working[index] = afterLines[index];
      setDraft(working.join("\n"));
      setHighlightRange({ startLine: line, endLine: line });
      const query = afterLines[index]?.trim();
      if (query) window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: { action: "locate", query } }));
      await new Promise((resolve) => window.setTimeout(resolve, 85));
    }

    if (token !== animationToken.current) return;
    setDraft(frame.content);
    setHighlightRange({ startLine: Math.min(...changed), endLine: Math.max(...changed) });
    setPatchState(`Applied · ${frame.path || activeFile.path} · lines ${Math.min(...changed)}-${Math.max(...changed)}`);
    addProof(`Worker patch applied visibly to ${frame.path || activeFile.path}, lines ${Math.min(...changed)}-${Math.max(...changed)}.`);
    window.setTimeout(() => setPatchState(""), 3200);
  }

  useEffect(() => { draftRef.current = codeDraft; }, [codeDraft]);
  useEffect(() => {
    animationToken.current += 1;
    setCodeDraft(activeFile.content || "");
    draftRef.current = activeFile.content || "";
    setBaseline(activeFile.content || "");
    setHighlightRange(null);
    if (ready) addProof(brainstormPreview ? `Preview mounted: ${route}` : `Source mounted: ${activeFile.repo}@${activeFile.branch}:${activeFile.path}`);
    setPreviewUrl("");
    setPreviewLifecycle(ready ? "ready" : "idle");
    setPreviewStatus(ready ? "Current source preview ready." : "No preview source is connected.");
  }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, activeFile.content, route, ready, brainstormPreview]);

  useEffect(() => {
    function onSummary(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) addProof(detail.message);
    }
    function onExternalPatch(event: Event) {
      const detail = (event as CustomEvent<RuntimeEvent>).detail || {};
      const frame = eventFrame(detail, activeFile.path);
      if (frame) void animatePatch(frame);
    }
    function onRuntimeJob(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      if (!detail?.jobId) return;
      addProof(`Runtime job queued: ${detail.jobId}`);
      let stopped = false;
      async function poll() {
        try {
          const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(detail.jobId || "")}`, { cache: "no-store", credentials: "same-origin" });
          const payload = await response.json().catch(() => null) as { ok?: boolean; events?: RuntimeEvent[]; error?: string; job?: { status?: string } } | null;
          if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Runtime proof unavailable");
          if (stopped) return;
          for (const item of payload.events || []) {
            const key = String(item.id || `${item.eventType || item.event_type}:${item.message}:${item.createdAt || item.created_at}`);
            if (seen.current.has(key)) continue;
            seen.current.add(key);
            addProof(`${item.eventType || item.event_type || "runtime"}: ${item.message || "event"}`);
            const frame = eventFrame(item, activeFile.path);
            if (frame) await animatePatch(frame);
          }
          if (/completed|failed|cancelled/.test(String(payload.job?.status || "").toLowerCase())) stopped = true;
        } catch (error) {
          if (!stopped) addProof(error instanceof Error ? error.message : "Runtime proof unavailable");
        }
      }
      void poll();
      const timer = window.setInterval(() => void poll(), 1200);
      window.setTimeout(() => { stopped = true; window.clearInterval(timer); }, 15 * 60 * 1000);
    }
    function onOpenPreview(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      if (detail.targetSurface === "visual-editor") return;
      const actionId = String(detail.clientRequestId || detail.turnId || detail.previewId || detail.previewUrl || "preview-open");
      const lifecycle = String(detail.lifecycleState || (detail.previewUrl ? "ready" : "opening")) as PreviewLifecycleState;
      if (actionId === lastPreviewActionRef.current && lifecycle === "opening") return;
      lastPreviewActionRef.current = actionId;
      const nextUrl = String(detail.previewUrl || "");
      if (nextUrl) setPreviewUrl(nextUrl);
      setTab("frontend");
      setPreviewLifecycle(lifecycle);
      setPreviewStatus(lifecycle === "ready" ? "Preview ready." : nextUrl || ready ? "Opening the current preview while work continues…" : "Waiting for preview source…");
      if (nextUrl) setFrameKey((value) => value + 1);
      addProof(`Preview lifecycle: ${lifecycle}${nextUrl ? ` · ${nextUrl}` : ""}`);
    }
    window.addEventListener("streams-builder-summary-event", onSummary);
    window.addEventListener("streams-builder:runtime-job", onRuntimeJob);
    window.addEventListener("streams-builder:worker-patch", onExternalPatch);
    window.addEventListener("streams:open-builder-preview", onOpenPreview);
    return () => {
      window.removeEventListener("streams-builder-summary-event", onSummary);
      window.removeEventListener("streams-builder:runtime-job", onRuntimeJob);
      window.removeEventListener("streams-builder:worker-patch", onExternalPatch);
      window.removeEventListener("streams:open-builder-preview", onOpenPreview);
    };
  }, [activeFile.path, ready]);

  const diff = useMemo(() => {
    const before = baseline.split("\n");
    const after = codeDraft.split("\n");
    const max = Math.max(before.length, after.length);
    const rows: string[] = [];
    for (let index = 0; index < max; index += 1) {
      if (before[index] === after[index]) continue;
      if (before[index] !== undefined) rows.push(`- ${String(index + 1).padStart(4, " ")} ${before[index]}`);
      if (after[index] !== undefined) rows.push(`+ ${String(index + 1).padStart(4, " ")} ${after[index]}`);
    }
    return rows.join("\n") || "No source changes.";
  }, [baseline, codeDraft]);

  return (
    <section className="liveWorkstation" aria-label="Live frontend workstation">
      <header className="workstationToolbar">
        <nav className="workingTabs" aria-label="Workstation views">
          {(["code", "diff", "logs", "media", "devtools", "frontend"] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{label(item)}</button>
          ))}
        </nav>
        <div className="sourceToolbar">
          {toolbar}
          <span className="routeValue" title={route}>{brainstormPreview ? "Preview" : "Route"} <b>{route}</b></span>
          <button type="button" className="refresh" onClick={() => setFrameKey((value) => value + 1)}>Refresh</button>
        </div>
      </header>

      <main className="workstationBody">
        {patchState ? <div className="patchCue" role="status">{patchState}</div> : null}
        <iframe ref={frameRef} key={`${frameKey}-${liveUrl}`} title="Live frontend preview" src={ready || previewUrl ? liveUrl : "about:blank"} className={tab === "frontend" ? "visible" : "hidden"} onLoad={() => { if (tab === "frontend" && (ready || previewUrl)) { setPreviewLifecycle("ready"); setPreviewStatus("Preview ready."); } }} />
        {tab === "code" ? <RuntimeCodeEditor value={codeDraft} filePath={activeFile.path || "brainstorm-preview"} repo={activeFile.repo} branch={activeFile.branch} sha={activeFile.sha} onChange={setDraft} highlightRange={highlightRange} /> : null}
        {tab === "diff" ? <pre className="diff">{diff}</pre> : null}
        {tab === "logs" ? <div className="proofList">{proof.length ? proof.map((item) => <p key={item.id} className={item.level}><span>{item.at}</span>{item.message}</p>) : <p>No runtime events yet.</p>}</div> : null}
        {tab === "media" ? <div className="empty">Screenshots and verified browser captures will appear here.</div> : null}
        <BrowserDevTools frameRef={frameRef} frameKey={frameKey} active={tab === "devtools"} />
        {tab === "frontend" && previewLifecycle !== "ready" ? <div className={ready || previewUrl ? "previewLifecycle stale" : "previewLifecycle"} role="status"><b>{previewLifecycle.replaceAll("-", " ")}</b><span>{previewStatus || "Preparing preview…"}</span>{ready && previewLifecycle !== "failed" ? <small>Showing the last available source while the preview updates.</small> : null}</div> : null}
        {!ready && !previewUrl && tab === "frontend" && previewLifecycle === "idle" ? <div className="empty overlay">Start brainstorming or pull a source file to open the preview.</div> : null}
      </main>

      <style jsx>{`
        .liveWorkstation{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#020617;color:#e5e7eb}
        .workstationToolbar{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid rgba(45,212,191,.28);background:#020617}
        .workingTabs,.sourceToolbar{min-width:0;display:flex;align-items:center;gap:4px;white-space:nowrap}
        .workingTabs{overflow-x:auto;overflow-y:hidden}.sourceToolbar{justify-content:flex-end;position:relative}
        .workstationToolbar:has(.githubSourceControl.expanded){grid-template-columns:1fr}.workstationToolbar:has(.githubSourceControl.expanded) .sourceToolbar{width:100%;justify-content:flex-start;flex-wrap:wrap}.workstationToolbar:has(.githubSourceControl.expanded) .githubSourceControl{order:3;flex-basis:100%;width:100%}
        .workstationToolbar button{height:28px;border:1px solid transparent;border-radius:8px;background:transparent;color:#6ee7b7;padding:0 10px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}
        .workstationToolbar button:hover{background:rgba(15,118,110,.18)}.workstationToolbar button.active{border-color:rgba(45,212,191,.55);background:rgba(6,78,59,.64);color:#99f6e4}.workstationToolbar .refresh{border-color:rgba(148,163,184,.24);color:#fff}
        .routeValue{max-width:220px;overflow:hidden;text-overflow:ellipsis;color:#6ee7b7;font-size:9px;text-transform:uppercase}.routeValue b{color:#fff;text-transform:none;font-size:10px}
        .workstationBody{position:relative;min-width:0;min-height:0;overflow:hidden;background:#020617}.workstationBody iframe{display:block;width:100%;height:100%;border:0;background:#fff}.workstationBody iframe.hidden{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.workstationBody iframe.visible{position:relative}
        .diff{height:100%;overflow:auto;margin:0;padding:12px;color:#dbeafe;font:11px/17px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;box-sizing:border-box}.patchCue{position:absolute;z-index:50;top:10px;left:50%;transform:translateX(-50%);max-width:70%;padding:7px 12px;border:1px solid rgba(45,212,191,.55);border-radius:999px;background:rgba(2,6,23,.92);box-shadow:0 12px 30px rgba(0,0,0,.4);color:#99f6e4;font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
        .empty{height:100%;display:grid;place-content:center;padding:20px;text-align:center;color:#94a3b8}.empty.overlay{position:absolute;inset:0;background:#020617}.previewLifecycle{position:absolute;inset:0;z-index:45;display:grid;place-content:center;gap:8px;padding:24px;text-align:center;background:#020617;color:#dbeafe}.previewLifecycle.stale{inset:auto 12px 12px;display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid rgba(56,189,248,.4);border-radius:10px;background:rgba(2,6,23,.9);text-align:left}.previewLifecycle b{text-transform:capitalize;font-size:11px}.previewLifecycle span,.previewLifecycle small{font-size:10px;color:#94a3b8}.proofList{height:100%;overflow:auto;padding:10px;box-sizing:border-box;display:grid;align-content:start;gap:6px}.proofList p{margin:0;border-left:3px solid #64748b;background:#0f172a;padding:7px 9px;font-size:10px;line-height:1.4}.proofList p span{display:inline-block;width:76px;color:#94a3b8}.proofList p.success{border-left-color:#22c55e}.proofList p.warning{border-left-color:#f59e0b}.proofList p.error{border-left-color:#ef4444}
        @media(max-width:1180px){.workstationToolbar{grid-template-columns:1fr}.sourceToolbar{justify-content:flex-start;flex-wrap:wrap}.routeValue{display:none}}
      `}</style>
    </section>
  );
}
