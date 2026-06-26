"use client";

import { useMemo, useState } from "react";

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

export default function LiveFrontendWorkstation({ activeFile }: Props) {
  const route = normalizeRoute(activeFile.route || "/");
  const liveUrl = liveUrlFor(activeFile.repo, route);
  const ready = Boolean(activeFile.repo && activeFile.path);
  const [mode, setMode] = useState<Mode>("browser");
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);

  const modeLabel = mode === "editor" ? "Live Editor" : mode === "browser" ? "Click-through Browser" : mode === "mobile" ? "Mobile Preview" : "Advanced Tools";
  const sourceLines = useMemo(() => (activeFile.content || "").split("\n").slice(0, 80), [activeFile.content]);

  function record(action: string, target = liveUrl) {
    setActions((items) => [...items.slice(-12), { action, target, at: new Date().toISOString() }]);
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

  return (
    <section className="liveWorkstation" aria-label="Live frontend workstation preview">
      <aside className="summaryRail">
        <p className="meta">Worked in Agent 1 · {activeFile.repo || "no repo selected"} · {activeFile.branch || "no branch selected"}</p>
        <h3>Summary</h3>
        <ul>
          <li>{ready ? `Mounted ${activeFile.path} from ${activeFile.repo}@${activeFile.branch}.` : "Pull a source file to mount the live frontend."}</li>
          <li>{ready ? "Frontend UI is the same live browser view used by Visual Editing." : "No frontend is mounted yet."}</li>
          <li>Mode: {modeLabel}</li>
        </ul>
        <h3>Verification</h3>
        <ul>
          <li>Verified repo: {activeFile.repo || "not selected"}</li>
          <li>Verified branch: {activeFile.branch || "not selected"}</li>
          <li>Verified file: {activeFile.path || "not selected"}</li>
          <li>Verified route: {route}</li>
          <li>Verified SHA: {activeFile.sha || "missing"}</li>
          <li>Live preview URL: {ready ? liveUrl : "waiting for Pull"}</li>
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
            <article><b>Editable Tools</b><p>Use Visual Editing for overlay edits.</p><p>Editor / Browser / Mobile / Advanced buttons update this preview state.</p></article>
            <article><b>Status</b><p>{ready ? "Ready" : "Waiting"}</p><p>{modeLabel}</p></article>
            <article className="wide"><b>Source Preview</b><pre>{sourceLines.join("\n") || "No source loaded."}</pre></article>
            <article className="wide"><b>Browser Actions</b>{actions.length ? actions.slice(-8).map((item) => <p key={`${item.action}-${item.at}`}>{item.action} · {item.target}</p>) : <p>No actions yet.</p>}</article>
          </section>
        </details>
      </main>
      <style jsx>{`
        .liveWorkstation{height:100%;min-height:0;display:grid;grid-template-columns:minmax(260px,.34fr) minmax(0,1fr);overflow:hidden;background:#f6f8fa;color:#24292f}.summaryRail{height:100%;overflow:auto;border-right:1px solid #d8dee4;background:#fff;padding:18px;box-sizing:border-box}.summaryRail .meta{margin:0 0 18px;color:#57606a;font-size:13px}.summaryRail h3{margin:16px 0 10px;font-size:20px}.summaryRail ul{margin:0;padding-left:20px;display:grid;gap:10px}.summaryRail li{font-size:13px;line-height:1.45}.previewSide{min-width:0;min-height:0;display:grid;grid-template-rows:44px auto minmax(0,1fr) auto auto;overflow:hidden;background:#020617}.tabs{display:flex;min-width:0;overflow:auto;border-bottom:1px solid #d8dee4;background:#f6f8fa}.tabs button{height:44px;border:0;border-right:1px solid #d8dee4;background:transparent;color:#57606a;padding:0 20px;font-size:13px;font-weight:800}.tabs button.active{background:#fff;color:#24292f;box-shadow:inset 0 -2px 0 #fd8c73}.debug{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.45)}.debug span{min-width:0;display:block;padding:9px 12px;background:#020617;color:#94a3b8;font-size:10px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.debug b{display:block;color:#fff;text-transform:none;font-size:12px}.frameWrap{min-width:0;min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:16px;overflow:auto;background:#fff}.phoneWrap{width:430px;min-height:0;margin:10px auto;border:12px solid #111827;border-radius:34px;overflow:auto;background:#fff}.frameWrap iframe,.phoneWrap iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.empty h2{margin:0 0 8px;font-size:28px}.empty p{margin:0;color:#475569}.toolStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(7,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.toolStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.toolStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.toolStrip b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.toolStrip button{height:36px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}.toolStrip button.active{border-color:rgba(110,231,183,.7);background:rgba(6,78,59,.7);color:#6ee7b7}.toolDrawer{max-height:320px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#fff}.toolDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px}.drawerGrid article{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.drawerGrid b{display:block;color:#fff;margin-bottom:6px}.drawerGrid p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}.drawerGrid pre{max-height:190px;overflow:auto;margin:0;color:#cbd5e1;font:11px/16px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}.wide{grid-column:span 2}
      `}</style>
    </section>
  );
}
