"use client";

import { useMemo, useState } from "react";
import type { LinePatchOperation, LinePatchPreview } from "@/lib/streams-builder/line-patch-model";

type PatchReviewModalProps = {
  open: boolean;
  title?: string;
  repository: string;
  branch: string;
  filePath: string;
  preview: LinePatchPreview | null;
  operations?: LinePatchOperation[];
  pushing?: boolean;
  onClose: () => void;
  onPush?: () => void;
};

function numberedLines(content: string) {
  return content.length ? content.split(/\r?\n/).map((line, index) => ({ lineNumber: index + 1, content: line })) : [];
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fileNameFromPath(path: string) {
  return path.split("/").filter(Boolean).pop() || "patched-file.txt";
}

export default function PatchReviewModal({
  open,
  title = "Patch Review",
  repository,
  branch,
  filePath,
  preview,
  operations = preview?.operations || [],
  pushing = false,
  onClose,
  onPush,
}: PatchReviewModalProps) {
  const [view, setView] = useState<"before" | "after">("after");
  const activeContent = view === "before" ? preview?.originalContent || "" : preview?.nextContent || "";
  const lines = useMemo(() => numberedLines(activeContent), [activeContent]);
  const touched = useMemo(() => new Set((preview?.touchedLineRanges || []).flatMap((range) => {
    const values: number[] = [];
    for (let line = range.startLine; line <= range.endLine; line += 1) values.push(line);
    return values;
  })), [preview]);

  if (!open) return null;

  const canPush = Boolean(preview?.ok && preview.canPushControlledPatch && onPush);
  const canDownload = Boolean(preview?.ok && preview.canDownloadFullFile);

  return (
    <div className="streamsPatchOverlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="streamsPatchModal">
        <header className="streamsPatchHeader">
          <div>
            <p className="streamsPatchEyebrow">REAL FILE PATCH MODAL</p>
            <h2>{title}</h2>
            <div className="streamsPatchTruth">
              <span>Repo: <b>{repository}</b></span>
              <span>Branch: <b>{branch}</b></span>
              <span>File: <b>{filePath}</b></span>
            </div>
          </div>
          <button type="button" className="streamsPatchClose" onClick={onClose} aria-label="Close patch review">×</button>
        </header>

        <section className="streamsPatchStatus">
          <div className={preview?.ok ? "statusGood" : "statusBad"}>{preview?.ok ? "PATCH VALID" : "PATCH BLOCKED"}</div>
          <div>{preview?.changedLineCount ?? 0} changed lines</div>
          <div>{preview?.isFullFileReplacement ? "Full-file replacement" : "Range patch"}</div>
          <div>{preview?.canPushControlledPatch ? "Push eligible" : "Push blocked until Source Truth + Checkpoint"}</div>
        </section>

        <section className="streamsPatchOps" aria-label="Patch operations">
          {operations.length ? operations.map((operation) => (
            <article key={operation.id}>
              <b>{operation.type}</b>
              <span>{operation.filePath}</span>
              <small>lines {operation.startLine}{operation.endLine ? `-${operation.endLine}` : ""}</small>
              <p>{operation.reason}</p>
            </article>
          )) : <p>No operations loaded.</p>}
        </section>

        <section className="streamsPatchToolbar">
          <div className="streamsPatchTabs">
            <button type="button" className={view === "before" ? "active" : ""} onClick={() => setView("before")}>Before</button>
            <button type="button" className={view === "after" ? "active" : ""} onClick={() => setView("after")}>After / Rebuilt Full File</button>
          </div>
          <div className="streamsPatchActions">
            <button type="button" disabled={!canDownload} onClick={() => preview && downloadTextFile(fileNameFromPath(filePath), preview.nextContent)}>Download Full File</button>
            <button type="button" disabled={!canPush || pushing} onClick={onPush}>{pushing ? "Pushing..." : "Push Controlled Patch"}</button>
          </div>
        </section>

        <section className="streamsPatchCode" aria-label="Line-numbered file preview">
          {lines.map((line) => (
            <div key={line.lineNumber} className={touched.has(line.lineNumber) ? "touched" : ""}>
              <span>{line.lineNumber}</span>
              <code>{line.content || " "}</code>
            </div>
          ))}
        </section>

        <footer className="streamsPatchFooter">
          <div>
            <b>Audit</b>
            {(preview?.audit || []).map((item) => <p key={item}>{item}</p>)}
            {(preview?.errors || []).map((item) => <p className="error" key={item}>{item}</p>)}
          </div>
          <p className="streamsPatchRule">Small and large replacements are allowed. Manual copy/paste is not required. Push remains blocked until Source Truth, checkpoint, preview, proof, and approval gates are satisfied.</p>
        </footer>
      </div>

      <style jsx>{`
        .streamsPatchOverlay { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; background: rgba(1, 5, 18, 0.78); backdrop-filter: blur(18px); color: #f8fbff; }
        .streamsPatchModal { width: min(1180px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: hidden; display: flex; flex-direction: column; border: 1px solid rgba(139, 92, 246, 0.45); border-radius: 22px; background: #080d1d; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
        .streamsPatchHeader { display: flex; justify-content: space-between; gap: 24px; padding: 18px 20px; border-bottom: 1px solid rgba(148, 163, 184, 0.18); }
        .streamsPatchEyebrow { margin: 0 0 5px; font-size: 11px; letter-spacing: .14em; color: #a78bfa; font-weight: 800; }
        h2 { margin: 0; font-size: 22px; }
        .streamsPatchTruth { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; font-size: 12px; color: #cbd5e1; }
        .streamsPatchTruth span { border: 1px solid rgba(148,163,184,.2); border-radius: 999px; padding: 6px 9px; background: rgba(15,23,42,.7); }
        .streamsPatchClose { width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(148,163,184,.25); color: #fff; background: rgba(15,23,42,.8); font-size: 24px; cursor: pointer; }
        .streamsPatchStatus { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 12px 20px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); }
        .streamsPatchStatus div { border: 1px solid rgba(148,163,184,.16); border-radius: 12px; padding: 10px; background: rgba(15,23,42,.55); font-size: 12px; }
        .statusGood { color: #34d399; }
        .statusBad { color: #fb7185; }
        .streamsPatchOps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 12px 20px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); }
        .streamsPatchOps article { border: 1px solid rgba(148,163,184,.14); border-radius: 14px; background: rgba(15,23,42,.58); padding: 10px; }
        .streamsPatchOps b, .streamsPatchOps span, .streamsPatchOps small { display: block; }
        .streamsPatchOps b { color: #c4b5fd; }
        .streamsPatchOps span { color: #e2e8f0; font-size: 12px; margin-top: 4px; word-break: break-all; }
        .streamsPatchOps small, .streamsPatchOps p { color: #94a3b8; margin: 5px 0 0; }
        .streamsPatchToolbar { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); }
        .streamsPatchTabs, .streamsPatchActions { display: flex; gap: 8px; flex-wrap: wrap; }
        button { border: 1px solid rgba(148,163,184,.22); border-radius: 11px; padding: 9px 12px; color: #fff; background: rgba(30,41,59,.8); cursor: pointer; }
        button.active, .streamsPatchActions button:last-child:not(:disabled) { background: linear-gradient(135deg, #6d28d9, #8b5cf6); border-color: rgba(196,181,253,.6); }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .streamsPatchCode { overflow: auto; flex: 1; min-height: 260px; background: #020617; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
        .streamsPatchCode div { display: grid; grid-template-columns: 64px 1fr; min-width: 920px; border-bottom: 1px solid rgba(30,41,59,.65); }
        .streamsPatchCode div.touched { background: rgba(124, 58, 237, 0.16); }
        .streamsPatchCode span { padding: 5px 12px; text-align: right; color: #64748b; user-select: none; border-right: 1px solid rgba(51,65,85,.8); }
        .streamsPatchCode code { padding: 5px 12px; color: #dbeafe; white-space: pre; }
        .streamsPatchFooter { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 12px 20px; border-top: 1px solid rgba(148, 163, 184, 0.12); color: #aab6c8; font-size: 12px; }
        .streamsPatchFooter p { margin: 5px 0 0; }
        .streamsPatchFooter .error { color: #fb7185; }
        .streamsPatchRule { border-left: 3px solid #8b5cf6; padding-left: 12px; }
        @media (max-width: 780px) { .streamsPatchStatus, .streamsPatchOps, .streamsPatchFooter { grid-template-columns: 1fr; } .streamsPatchToolbar { align-items: stretch; flex-direction: column; } }
      `}</style>
    </div>
  );
}
