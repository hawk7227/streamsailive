"use client";

import { useEffect, useMemo, useState } from "react";
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

type ViewMode = "split" | "code" | "preview";
type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };

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
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [codeDraft, setCodeDraft] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const ready = Boolean(activeFile.repo && activeFile.path);
  const liveUrl = useMemo(() => liveUrlFor(activeFile), [activeFile.repo, activeFile.route]);
  const isDirty = codeDraft !== (activeFile.content || "");

  useEffect(() => {
    setCodeDraft(activeFile.content || "");
    setPreviewKey((value) => value + 1);
    setSelection(null);
  }, [activeFile.repo, activeFile.branch, activeFile.path, activeFile.sha, activeFile.content]);

  return (
    <section className="selectedRepoEditor" aria-label="Selected repository visual editor">
      <header className="top">
        <div>
          <b>Visual Component Editor</b>
          <span>{ready ? `${activeFile.repo}@${activeFile.branch} · ${activeFile.path}` : "Pull a source file to start"}</span>
        </div>
        <div className="actions">
          <button type="button" className={viewMode === "split" ? "active" : ""} onClick={() => setViewMode("split")}>Code + Frontend</button>
          <button type="button" className={viewMode === "code" ? "active" : ""} onClick={() => setViewMode("code")}>Code</button>
          <button type="button" className={viewMode === "preview" ? "active" : ""} onClick={() => setViewMode("preview")}>Frontend UI</button>
          <button type="button" onClick={() => setPreviewKey((value) => value + 1)}>Refresh preview</button>
          <button type="button" disabled={!ready || !isDirty}>Stage</button>
        </div>
      </header>

      <div className="sourceStrip">
        <span><b>Repo</b>{activeFile.repo || "not selected"}</span>
        <span><b>Branch</b>{activeFile.branch || "not selected"}</span>
        <span><b>File</b>{activeFile.path || "not selected"}</span>
        <span><b>Route</b>{normalizeRoute(activeFile.route)}</span>
        <span><b>Preview</b>{ready ? liveUrl : "waiting for pull"}</span>
      </div>

      <main className={`body ${viewMode}`}>
        {viewMode !== "preview" ? (
          <section className="codePane">
            <RuntimeCodeEditor
              value={codeDraft}
              filePath={activeFile.path || "no-file-selected"}
              sha={activeFile.sha}
              onChange={setCodeDraft}
              onSelectionChange={setSelection}
            />
          </section>
        ) : null}

        {viewMode !== "code" ? (
          <section className="previewPane">
            <div className="paneTitle"><b>Actual frontend preview</b><span>{liveUrl}</span></div>
            <div className="previewBox">
              {ready ? <iframe key={`${previewKey}-${liveUrl}`} title="Actual selected repository frontend" src={liveUrl} /> : <div className="empty">Pull a source file first.</div>}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="statusBar">
        <div><span>Mode</span><b>{viewMode === "split" ? "Code and frontend side by side" : viewMode}</b></div>
        <div><span>Code selection</span><b>{selection ? `Lines ${selection.startLine}-${selection.endLine}` : "none"}</b></div>
        <div><span>Next</span><b>AI patch transaction lane + inspect bridge</b></div>
      </footer>

      <style jsx>{`
        .selectedRepoEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#050915;color:#f8fafc;overflow:hidden}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.actions{display:flex;gap:8px;align-items:center}.actions button{height:30px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#7c3aed;color:#fff;padding:0 10px;font-size:11px;font-weight:800;cursor:pointer}.actions button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}.actions button:disabled{opacity:.45;cursor:not-allowed}.sourceStrip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.35)}.sourceStrip span{min-width:0;display:block;padding:8px 10px;background:#020617;color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sourceStrip b{display:block;color:#6ee7b7;font-size:9px;text-transform:uppercase}.body{min-height:0;display:grid;background:rgba(148,163,184,.18);overflow:hidden}.body.split{grid-template-columns:minmax(360px,.9fr) minmax(420px,1fr)}.body.code,.body.preview{grid-template-columns:minmax(0,1fr)}.codePane,.previewPane{min-width:0;min-height:0;display:grid;background:#050915;overflow:hidden}.previewPane{grid-template-rows:auto minmax(0,1fr)}.paneTitle{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;font-size:11px}.paneTitle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93c5fd}.previewBox{min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:14px;overflow:auto;background:#fff}.previewBox iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-items:center;color:#0f172a}.statusBar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.statusBar div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.statusBar span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.statusBar b{display:block;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      `}</style>
    </section>
  );
}
