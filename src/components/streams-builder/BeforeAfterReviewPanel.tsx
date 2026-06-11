"use client";

import { useEffect, useState } from "react";
import type { BeforeAfterReviewRecord } from "@/lib/streams-builder/before-after-review";

type ApiResult = { ok: boolean; reviews?: BeforeAfterReviewRecord[]; review?: BeforeAfterReviewRecord; error?: string };

type Props = {
  projectId?: string;
  sessionId?: string;
  route?: string;
  previewUrl?: string;
  component?: string;
  file?: string;
  githubPath?: string;
};

export default function BeforeAfterReviewPanel({
  projectId = "streams-builder",
  sessionId = "streams-builder-session",
  route = "/streams-builder",
  previewUrl = "/streams-builder",
  component = "WorkspaceGrid",
  file = "src/components/streams-builder/WorkspaceGrid.tsx",
  githubPath = "src/components/streams-builder/WorkspaceGrid.tsx",
}: Props) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<BeforeAfterReviewRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueTitle, setIssueTitle] = useState("Confirm frontend issue before repair");
  const [issueSummary, setIssueSummary] = useState("Show current frontend state so user and AI confirm the same issue before repair.");
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
    if (!json.ok) {
      setError(json.error || "Unable to load before/after reviews");
      return;
    }
    setReviews(json.reviews || []);
  }

  useEffect(() => { void load(); }, []);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/streams-builder/before-after-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as ApiResult;
      if (!json.ok && !json.review) throw new Error(json.error || "Before/After action failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Before/After action failed");
    } finally {
      setBusy(false);
    }
  }

  function createBefore() {
    return post({
      action: "create_before",
      projectId,
      sessionId,
      issueTitle,
      issueSummary,
      requestedChange,
      route,
      previewUrl,
      component,
      file,
      githubPath,
      workspaceId: "visual-editing",
      beforeViewport: "desktop",
      proofStatus: "UNPROVEN",
    });
  }

  function attachAfter() {
    if (!active) {
      setError("Create a BEFORE confirmation first.");
      return;
    }
    return post({
      action: "attach_after",
      reviewId: active.id,
      jobId: active.jobId,
      afterPreviewUrl,
      afterViewport: active.before.viewport,
      changedFiles: changedFiles.split("\n").map((value) => value.trim()).filter(Boolean),
      patchSummary,
    });
  }

  function decide(decision: "approve" | "request_changes" | "reject") {
    if (!active) {
      setError("Create a BEFORE confirmation first.");
      return;
    }
    return post({ action: "decide", reviewId: active.id, jobId: active.jobId, decision, comment });
  }

  return (
    <section className="baPanel" aria-label="Before After Review">
      <button type="button" className="baButton" onClick={() => setOpen((value) => !value)}>
        Before / After Review <span>{active?.approval.state || "ready"}</span>
      </button>
      {open ? (
        <div className="baShell">
          <header>
            <div>
              <p>FRONTEND VISUAL CONFIRMATION GATE</p>
              <h2>Confirm issue first. Preview fix second. Release only after approval.</h2>
            </div>
            <button type="button" onClick={load}>Refresh</button>
          </header>
          {error ? <div className="error">{error}</div> : null}
          <div className="grid">
            <aside>
              <h3>1. BEFORE confirmation</h3>
              <label>Issue title<input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} /></label>
              <label>Issue summary<textarea value={issueSummary} onChange={(event) => setIssueSummary(event.target.value)} /></label>
              <label>Requested repair<textarea value={requestedChange} onChange={(event) => setRequestedChange(event.target.value)} /></label>
              <button type="button" className="primary" onClick={createBefore} disabled={busy}>Create BEFORE confirmation</button>
            </aside>
            <main>
              <div className="compare">
                <VisualCard title="BEFORE" value={active?.before.previewUrl || previewUrl} note="Current frontend state for issue confirmation." />
                <VisualCard title="AFTER" value={active?.after?.previewUrl || afterPreviewUrl} note={active?.after ? "Repaired preview awaiting approval." : "Attach repaired preview before approval."} />
              </div>
              <div className="truth"><span>Route: {active?.sourceTruth.route || route}</span><span>Component: {active?.sourceTruth.component || component}</span><span>File: {active?.sourceTruth.file || file}</span><span>GitHub: {active?.sourceTruth.githubPath || githubPath}</span></div>
              <section><h3>2. AFTER repair preview</h3><label>After preview URL<input value={afterPreviewUrl} onChange={(event) => setAfterPreviewUrl(event.target.value)} /></label><label>Changed files<textarea value={changedFiles} onChange={(event) => setChangedFiles(event.target.value)} /></label><label>Patch summary<textarea value={patchSummary} onChange={(event) => setPatchSummary(event.target.value)} /></label><button type="button" onClick={attachAfter} disabled={busy}>Attach AFTER preview</button></section>
              <section><h3>3. User approval gate</h3><p>Code release remains blocked until the AFTER preview is approved.</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Approval comment or requested changes" /><div className="actions"><button type="button" className="approve" onClick={() => decide("approve")} disabled={busy || !active?.after}>Approve Fix</button><button type="button" className="changes" onClick={() => decide("request_changes")} disabled={busy}>Request Changes</button><button type="button" className="reject" onClick={() => decide("reject")} disabled={busy}>Reject</button></div></section>
            </main>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        .baPanel{position:fixed;right:14px;bottom:14px;z-index:70;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.baButton{border:1px solid rgba(139,92,246,.55);border-radius:999px;background:#030712;color:#fff;padding:10px 14px;font-size:12px;font-weight:900;box-shadow:0 18px 50px rgba(0,0,0,.4)}.baButton span{margin-left:8px;border-radius:999px;background:rgba(124,58,237,.25);color:#c4b5fd;padding:4px 8px;font-size:10px}.baShell{width:min(980px,calc(100vw - 28px));height:min(700px,calc(100vh - 70px));margin-bottom:10px;border:1px solid rgba(139,92,246,.45);border-radius:20px;background:#060b19;color:#fff;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr);box-shadow:0 24px 90px rgba(0,0,0,.55)}header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px;border-bottom:1px solid rgba(148,163,184,.14);background:#081120}header p{margin:0 0 4px;color:#a78bfa;font-size:11px;font-weight:900;letter-spacing:.16em}header h2{margin:0;font-size:18px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(15,23,42,.92);color:#fff;padding:9px 12px;font-size:11px;font-weight:900;cursor:pointer}button:disabled{opacity:.45}.primary,.approve{background:linear-gradient(135deg,#059669,#34d399);color:#03110d}.changes{background:#f59e0b;color:#111827}.reject{background:rgba(127,29,29,.7);border-color:rgba(239,68,68,.55)}.error{margin:10px 16px 0;border:1px solid rgba(248,113,113,.35);border-radius:12px;background:rgba(127,29,29,.22);color:#fecaca;padding:10px;font-size:12px}.grid{min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr);gap:12px;padding:12px;overflow:hidden}aside,main section{border:1px solid rgba(148,163,184,.13);border-radius:16px;background:rgba(15,23,42,.62);padding:12px}aside{min-height:0;overflow:auto}main{min-width:0;min-height:0;overflow:auto;display:grid;gap:12px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:12px}.truth{display:grid;gap:6px;border:1px solid rgba(148,163,184,.13);border-radius:14px;background:rgba(2,6,23,.55);padding:10px}.truth span{color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}h3{margin:0 0 10px;font-size:13px}label{display:grid;gap:5px;margin-bottom:9px;color:#94a3b8;font-size:10px;font-weight:800}input,textarea{border:1px solid rgba(51,65,85,.9);border-radius:9px;background:#020617;color:#fff;padding:8px;font-size:12px}textarea{min-height:70px;resize:vertical}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}section p{margin:0 0 10px;color:#cbd5e1;font-size:12px}@media(max-width:920px){.grid,.compare,.actions{grid-template-columns:1fr}.baShell{height:min(760px,calc(100vh - 70px))}}
      `}</style>
    </section>
  );
}

function VisualCard({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="card"><b>{title}</b><p>{note}</p><small>{value}</small><style jsx>{`.card{min-height:190px;border:1px solid rgba(148,163,184,.13);border-radius:14px;background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(15,23,42,.82));padding:14px;display:grid;align-content:center;text-align:center}b{font-size:16px}p{margin:10px 0;color:#cbd5e1;font-size:12px}small{color:#94a3b8;font-size:10px;word-break:break-word}`}</style></article>;
}
