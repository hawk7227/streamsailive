"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  stationLabel: string;
  route: string;
  filePath: string;
  repo: string;
  branch: string;
  content: string;
  onContentChange: (next: string) => void;
  onProof: (message: string) => void;
  onChat: (message: string) => void;
};

type ViewMode = "editor" | "browser" | "mobile" | "advanced";
type EditEvent = { id?: string; selector?: string; original?: string; text?: string };

function normalizeRoute(value: string) {
  const trimmed = (value || "/").trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function repoName(repo: string) {
  return (repo || "").split("/").pop() || "";
}

function deploymentUrl(repo: string, route: string) {
  const app = repoName(repo);
  const path = normalizeRoute(route);
  if (typeof window !== "undefined" && repo === "hawk7227/streamsailive") return `${window.location.origin}${path}`;
  if (repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${path}`;
  if (repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${path}`;
  return app ? `https://${app}.vercel.app${path}` : path;
}

function editableProxyUrl(url: string) {
  return `/api/streams-builder/editable-preview?url=${encodeURIComponent(url)}`;
}

function replaceFirst(content: string, from?: string, to?: string) {
  const original = String(from || "").trim();
  const next = String(to || "").trim();
  if (!original || !next || original === next || !content.includes(original)) return content;
  return content.replace(original, next);
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceRoute = normalizeRoute(route);
  const defaultUrl = useMemo(() => deploymentUrl(repo, sourceRoute), [repo, sourceRoute]);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [browserUrl, setBrowserUrl] = useState(defaultUrl);
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EditEvent | null>(null);
  const [edits, setEdits] = useState<EditEvent[]>([]);
  const ready = Boolean(repo && filePath);
  const liveUrl = browserUrl || defaultUrl;
  const editorUrl = editableProxyUrl(liveUrl);

  useEffect(() => {
    setBrowserUrl(defaultUrl);
    setSelected(null);
    setEdits([]);
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof(`Visual editor mounted original page through same-origin editable preview: ${repo || "no repo"}@${branch || "no branch"}:${sourceRoute}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, branch, sourceRoute, filePath, defaultUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.source !== "streams-editable-preview") return;
      const payload = (data.payload || {}) as EditEvent;
      if (data.type === "streams-editable-select") {
        setSelected(payload);
        onChat(`Selected text on original page: ${payload.text || ""}`);
      }
      if (data.type === "streams-editable-input") {
        setSelected(payload);
      }
      if (data.type === "streams-editable-commit") {
        setSelected(payload);
        setEdits((items) => [...items.slice(-20), payload]);
        const nextContent = replaceFirst(content || "", payload.original, payload.text);
        if (nextContent !== content) onContentChange(nextContent);
        onProof(`Edited original page text in place: ${payload.original || ""} → ${payload.text || ""}`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [content, onChat, onContentChange, onProof]);

  function switchMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    if (nextMode === "advanced") setDrawerOpen(true);
    setFrameKey((value) => value + 1);
    onProof(`Visual editor mode: ${nextMode}`);
  }

  function refreshPreview() {
    setFrameKey((value) => value + 1);
    onProof(`Refreshed preview: ${liveUrl}`);
  }

  function resetEditor() {
    setBrowserUrl(defaultUrl);
    setSelected(null);
    setEdits([]);
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof("Reset visual editor to original page source truth.");
  }

  return (
    <section className="visualEditor">
      <header className="top">
        <div><b>VISUAL EDITOR</b><span>{stationLabel} · Editor mode uses the original page, made editable in place</span></div>
        <div className="routeBar"><button type="button" onClick={refreshPreview}>↻</button><input value={liveUrl} onChange={(event) => setBrowserUrl(event.target.value)} /><button type="button" onClick={refreshPreview}>Open</button></div>
      </header>

      <main className={`canvas ${viewMode}`}>
        <section className={viewMode === "mobile" ? "phoneFrame" : "desktopFrame"}>
          {ready ? <iframe key={`${frameKey}-${viewMode}-${liveUrl}`} title="Editable original frontend preview" src={viewMode === "editor" || viewMode === "advanced" ? editorUrl : liveUrl} /> : <div className="emptyFrame"><h2>Pull a source file first</h2><p>The actual frontend will appear here.</p></div>}
        </section>
      </main>

      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Selected</span><b>{selected?.text || "Click text on page"}</b></div><div><span>File</span><b>{filePath || "no file"}</b></div><div><span>Branch</span><b>{branch || "no branch"}</b></div><div><span>Mode</span><b>{viewMode}</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "advanced" ? "active" : ""} onClick={() => switchMode("advanced")}>Advanced</button><button type="button" onClick={refreshPreview}>Save</button><button type="button" onClick={resetEditor}>Reset</button></footer>

      <details className="editorDrawer" open={drawerOpen || viewMode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}><summary>Advanced edit log / source controls</summary><section className="drawerGrid"><section className="patchBox"><b>Selected</b><p>selector: {selected?.selector || "none"}</p><p>original: {selected?.original || "none"}</p><p>current: {selected?.text || "none"}</p><p>file: {filePath || "none"}</p></section><section className="patchBox"><b>Recent edits</b>{edits.length ? edits.slice(-8).map((edit, index) => <p key={`${edit.id}-${index}`}>{edit.original} → {edit.text}</p>) : <p>No edits yet.</p>}</section></section></details>

      <style jsx>{`
        .visualEditor{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#020617;color:#fff;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(148,163,184,.18);background:#0f172a}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.routeBar{display:grid;grid-template-columns:40px minmax(260px,1fr) 80px;gap:8px;width:min(680px,56vw)}.routeBar input{height:38px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#fff;padding:0 14px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}.canvas{position:relative;min-height:0;overflow:hidden;background:#020617}.desktopFrame{position:relative;height:calc(100% - 18px);margin:10px;border:1px solid rgba(124,58,237,.5);border-radius:16px;overflow:auto;background:#fff}.phoneFrame{position:relative;width:430px;height:min(760px,calc(100% - 30px));margin:12px auto;border:12px solid #111827;border-radius:36px;overflow:auto;background:#fff}.desktopFrame iframe,.phoneFrame iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.emptyFrame{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(6,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:260px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.patchBox{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}
      `}</style>
    </section>
  );
}
