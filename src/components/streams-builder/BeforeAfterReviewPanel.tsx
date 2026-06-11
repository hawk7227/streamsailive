"use client";

import { useEffect, useState } from "react";
import type { BeforeAfterReviewRecord } from "@/lib/streams-builder/before-after-review";

type ApiResult = { ok: boolean; reviews?: BeforeAfterReviewRecord[]; review?: BeforeAfterReviewRecord; error?: string };

type Props = { projectId?: string; sessionId?: string; route?: string; previewUrl?: string; component?: string; file?: string; githubPath?: string };

export default function BeforeAfterReviewPanel({ projectId = "streams-builder", sessionId = "streams-builder-session", route = "/streams-builder", previewUrl = "/streams-builder", component = "WorkspaceGrid", file = "src/components/streams-builder/WorkspaceGrid.tsx", githubPath = "src/components/streams-builder/WorkspaceGrid.tsx" }: Props) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<BeforeAfterReviewRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueTitle, setIssueTitle] = useState("Confirm frontend issue before repair");
  const [issueSummary, setIssueSummary] = useState("Show the live frontend state so user and AI confirm the same issue before repair.");
  const [requestedChange, setRequestedChange] = useState("Describe requested repair.");
  const [afterPreviewUrl, setAfterPreviewUrl] = useState(previewUrl);
  const [changedFiles, setChangedFiles] = useState(file);
  const [patchSummary, setPatchSummary] = useState("Repair preview prepared. Approval required before release.");
  const [comment, setComment] = useState("");
  const active = reviews[0] || null;

  async function load() {
    setError(null);
    const response = await fetch(`/api/streams-builder/before-after-reviews?projectId=${encodeURIComponent(projectId)}`);
    const json = (await response.json()) as ApiResult;
    if (!json.ok) { setError(json.error || "Unable to load live proof reviews"); return; }
    setReviews(json.reviews || []);
  }

  useEffect(() => { void load(); }, []);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/streams-builder/before-after-reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await response.json()) as ApiResult;
      if (!json.ok && !json.review) throw new Error(json.error || "Live proof action failed");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Live proof action failed"); } finally { setBusy(false); }
  }

  const createBefore = () => post({ action: "create_before", projectId, sessionId, issueTitle, issueSummary, requestedChange, route, previewUrl, component, file, githubPath, workspaceId: "visual-editing", beforeViewport: "desktop", proofStatus: "UNPROVEN" });
  const attachAfter = () => active ? post({ action: "attach_after", reviewId: active.id, jobId: active.jobId, afterPreviewUrl, afterViewport: active.before.viewport, changedFiles: changedFiles.split("\n").map((value) => value.trim()).filter(Boolean), patchSummary }) : setError("Create a live BEFORE confirmation first.");
  const decide = (decision: "approve" | "request_changes" | "reject") => active ? post({ action: "decide", reviewId: active.id, jobId: active.jobId, decision, comment }) : setError("Create a live BEFORE confirmation first.");

  return (
    <section className="gate" aria-label="Live Frontend Proof Gate">
      <button type="button" className="tab" onClick={() => setOpen((value) => !value)}>Live Frontend Proof Gate <span>{active?.approval.state || "ready"}</span></button>
      {open ? <div className="shell">
        <header><div><p>LIVE FRONTEND PROOF GATE</p><h2>No screenshots. No links. Real browser UI before and after approval.</h2></div><button type="button" onClick={load}>Refresh</button></header>
        {error ? <div className="error">{error}</div> : null}
        <div className="layout">
          <aside><h3>1. Confirm live issue target</h3><label>Issue title<input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} /></label><label>Issue summary<textarea value={issueSummary} onChange={(event) => setIssueSummary(event.target.value)} /></label><label>Requested repair<textarea value={requestedChange} onChange={(event) => setRequestedChange(event.target.value)} /></label><button className="primary" type="button" onClick={createBefore} disabled={busy}>Create live BEFORE confirmation</button></aside>
          <main>
            <div className="views"><LiveView title="LIVE BEFORE" url={active?.before.previewUrl || previewUrl} note="Current browser-rendered issue state." /><LiveView title="LIVE AFTER" url={active?.after?.previewUrl || afterPreviewUrl} note={active?.after ? "Browser-rendered repaired state." : "Attach repaired preview before approval."} /></div>
            <div className="truth"><b>Route</b><span>{active?.sourceTruth.route || route}</span><b>Component</b><span>{active?.sourceTruth.component || component}</span><b>File</b><span>{active?.sourceTruth.file || file}</span><b>GitHub</b><span>{active?.sourceTruth.githubPath || githubPath}</span></div>
            <section><h3>2. Attach live AFTER preview</h3><label>After preview route or URL<input value={afterPreviewUrl} onChange={(event) => setAfterPreviewUrl(event.target.value)} /></label><label>Changed files<textarea value={changedFiles} onChange={(event) => setChangedFiles(event.target.value)} /></label><label>Browser test notes<textarea value={patchSummary} onChange={(event) => setPatchSummary(event.target.value)} /></label><button type="button" onClick={attachAfter} disabled={busy}>Attach live AFTER preview</button></section>
            <section><h3>3. User approval gate</h3><p>AI cannot call fixed, push, merge, deploy, or save version until the live AFTER view is approved.</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Approval comment or requested changes" /><div className="actions"><button className="approve" type="button" onClick={() => decide("approve")} disabled={busy || !active?.after}>Approve Fix</button><button className="changes" type="button" onClick={() => decide("request_changes")} disabled={busy}>Request Changes</button><button className="reject" type="button" onClick={() => decide("reject")} disabled={busy}>Reject</button></div></section>
          </main>
        </div>
      </div> : null}
      <style jsx>{`.gate{position:fixed;right:14px;bottom:14px;z-index:80;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.tab{border:1px solid rgba(139,92,246,.6);border-radius:999px;background:#030712;color:#fff;padding:10px 14px;font-size:12px;font-weight:900}.tab span{margin-left:8px;border-radius:999px;background:rgba(124,58,237,.25);color:#c4b5fd;padding:4px 8px;font-size:10px}.shell{width:min(1180px,calc(100vw - 28px));height:min(760px,calc(100vh - 70px));margin-bottom:10px;border:1px solid rgba(139,92,246,.45);border-radius:20px;background:#060b19;color:#fff;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr;box-shadow:0 24px 90px rgba(0,0,0,.55)}header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px;border-bottom:1px solid rgba(148,163,184,.14);background:#081120}header p{margin:0 0 4px;color:#a78bfa;font-size:11px;font-weight:900;letter-spacing:.16em}header h2{margin:0;font-size:18px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(15,23,42,.92);color:#fff;padding:9px 12px;font-size:11px;font-weight:900;cursor:pointer}button:disabled{opacity:.45}.primary,.approve{background:linear-gradient(135deg,#059669,#34d399);color:#03110d}.changes{background:#f59e0b;color:#111827}.reject{background:rgba(127,29,29,.7);border-color:rgba(239,68,68,.55)}.error{margin:10px 16px 0;border:1px solid rgba(248,113,113,.35);border-radius:12px;background:rgba(127,29,29,.22);color:#fecaca;padding:10px;font-size:12px}.layout{min-height:0;display:grid;grid-template-columns:300px 1fr;gap:12px;padding:12px;overflow:hidden}aside,main section{border:1px solid rgba(148,163,184,.13);border-radius:16px;background:rgba(15,23,42,.62);padding:12px}aside{overflow:auto}main{min-width:0;overflow:auto;display:grid;gap:12px}.views{display:grid;grid-template-columns:1fr 1fr;gap:12px}.truth{display:grid;grid-template-columns:auto 1fr;gap:6px;border:1px solid rgba(148,163,184,.13);border-radius:14px;background:rgba(2,6,23,.55);padding:10px}.truth b{color:#94a3b8;font-size:10px}.truth span{color:#e2e8f0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}h3{margin:0 0 10px;font-size:13px}label{display:grid;gap:5px;margin-bottom:9px;color:#94a3b8;font-size:10px;font-weight:800}input,textarea{border:1px solid rgba(51,65,85,.9);border-radius:9px;background:#020617;color:#fff;padding:8px;font-size:12px}textarea{min-height:70px;resize:vertical}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}section p{margin:0 0 10px;color:#cbd5e1;font-size:12px}@media(max-width:920px){.layout,.views,.actions{grid-template-columns:1fr}.shell{height:min(760px,calc(100vh - 70px))}}`}</style>
    </section>
  );
}

function LiveView({ title, url, note }: { title: string; url: string; note: string }) {
  return <article className="live"><header><b>{title}</b><span>{url}</span></header><iframe title={title} src={url} /><footer>{note}</footer><style jsx>{`.live{min-width:0;min-height:260px;border:1px solid rgba(148,163,184,.13);border-radius:14px;background:#020617;overflow:hidden;display:grid;grid-template-rows:auto minmax(220px,1fr) auto}header{display:flex;justify-content:space-between;gap:10px;padding:10px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.85)}b{font-size:12px}span{font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}iframe{width:100%;height:100%;border:0;background:white}footer{border-top:1px solid rgba(148,163,184,.12);padding:8px 10px;color:#cbd5e1;font-size:11px}`}</style></article>;
}
