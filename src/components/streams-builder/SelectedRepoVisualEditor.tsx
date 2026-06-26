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

function normalizeRoute(route?: string) {
  const value = (route || "/").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

function repoName(repo?: string) {
  return (repo || "").split("/").pop() || "";
}

function liveUrlFor(source: PulledFileDetail) {
  const route = normalizeRoute(source.route);
  if (source.repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${route}`;
  if (source.repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${route}`;
  const app = repoName(source.repo);
  return app ? `https://${app}.vercel.app${route}` : route;
}

export default function SelectedRepoVisualEditor({ activeFile }: Props) {
  const [showCode, setShowCode] = useState(true);
  const [codeDraft, setCodeDraft] = useState(activeFile.content || "");
  const [previewKey, setPreviewKey] = useState(0);
  const ready = Boolean(activeFile.repo && activeFile.path);
  const liveUrl = useMemo(() => liveUrlFor(activeFile), [activeFile.repo, activeFile.route]);

  return (
    <section className="selectedRepoEditor" aria-label="Selected repository visual editor">
      <header className="top">
        <div>
          <b>Visual Component Editor</b>
          <span>{ready ? `${activeFile.repo}@${activeFile.branch} · ${activeFile.path}` : "Pull a source file to start"}</span>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setShowCode((value) => !value)}>{showCode ? "Hide code" : "Show code"}</button>
          <button type="button" onClick={() => setPreviewKey((value) => value + 1)}>Refresh preview</button>
          <button type="button" disabled={!ready}>Stage</button>
        </div>
      </header>

      <div className="sourceStrip">
        <span><b>Repo</b>{activeFile.repo || "not selected"}</span>
        <span><b>Branch</b>{activeFile.branch || "not selected"}</span>
        <span><b>File</b>{activeFile.path || "not selected"}</span>
        <span><b>Route</b>{normalizeRoute(activeFile.route)}</span>
        <span><b>Preview</b>{ready ? liveUrl : "waiting for pull"}</span>
      </div>

      <main className={showCode ? "body hasCode" : "body"}>
        {showCode ? (
          <section className="codePane">
            <div className="paneTitle">Pulled source code</div>
            <textarea value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} spellCheck="false" />
            <div className="fileInfo">{activeFile.path || "No file"} · {codeDraft.length} bytes</div>
          </section>
        ) : null}

        <section className="previewPane">
          <div className="paneTitle">Actual frontend preview</div>
          <div className="previewBox">
            {ready ? <iframe key={`${previewKey}-${liveUrl}`} title="Actual selected repository frontend" src={liveUrl} /> : <div className="empty">Pull a source file first.</div>}
          </div>
        </section>
      </main>

      <footer className="statusBar">
        <div><span>Mode</span><b>Selected repo foundation</b></div>
        <div><span>SHA</span><b>{activeFile.sha || "missing"}</b></div>
        <div><span>Next</span><b>inspect bridge / property panel</b></div>
      </footer>

      <style jsx>{`
        .selectedRepoEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#050915;color:#f8fafc;overflow:hidden}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.actions{display:flex;gap:8px}.actions button{height:30px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#7c3aed;color:#fff;padding:0 10px;font-size:11px;font-weight:800;cursor:pointer}.actions button:disabled{opacity:.45;cursor:not-allowed}.sourceStrip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.35)}.sourceStrip span{min-width:0;display:block;padding:8px 10px;background:#020617;color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sourceStrip b{display:block;color:#6ee7b7;font-size:9px;text-transform:uppercase}.body{min-height:0;display:grid;grid-template-columns:minmax(0,1fr);background:rgba(148,163,184,.18);overflow:hidden}.body.hasCode{grid-template-columns:minmax(320px,.9fr) minmax(360px,1fr)}.codePane,.previewPane{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#050915;overflow:hidden}.paneTitle{padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;font-size:11px;font-weight:900}.codePane textarea{width:100%;height:100%;border:0;background:#050915;color:#e5e7eb;resize:none;outline:none;padding:16px;box-sizing:border-box;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.fileInfo{padding:8px 10px;border-top:1px solid rgba(148,163,184,.18);background:#020617;color:#94a3b8;font-size:11px}.previewBox{min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:14px;overflow:auto;background:#fff}.previewBox iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-items:center;color:#0f172a}.statusBar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.statusBar div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.statusBar span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.statusBar b{display:block;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      `}</style>
    </section>
  );
}
