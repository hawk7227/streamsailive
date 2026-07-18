"use client";

import { useEffect, useMemo, useState } from "react";

type DraftState = {
  repo?: string;
  branch?: string;
  filePath?: string;
  checkpointId?: string;
  previewBuildState?: string;
  previewUrl?: string;
  previewBranch?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
};

type PullRequestState = {
  number: number;
  url: string;
  title: string;
  state: string;
  draft: boolean;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  mergeable: boolean | null;
  mergeableState: string;
  approvalState: string;
  checks: Array<{ name: string; status: string; conclusion: string; url: string }>;
  checksPassed: boolean;
  mergeAllowed: boolean;
};

export default function PullRequestReviewPanel() {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pullRequest, setPullRequest] = useState<PullRequestState | null>(null);
  const [status, setStatus] = useState("Loading reviewed change state…");
  const [busy, setBusy] = useState(false);

  const canCreate = Boolean(
    draft?.repo &&
    draft?.branch &&
    draft?.previewBranch &&
    draft.previewBuildState === "succeeded" &&
    draft.previewUrl &&
    draft.checkpointId,
  );

  const title = useMemo(() => {
    const file = String(draft?.filePath || "reviewed builder change").split("/").pop() || "reviewed builder change";
    return `Streams Builder: ${file}`;
  }, [draft?.filePath]);

  async function loadWorkspace() {
    const response = await fetch("/api/v1/builder/workspaces", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Unable to read builder workspace state.");
    const nextDraft = (data.snapshot?.draft || null) as DraftState | null;
    setDraft(nextDraft);
    if (nextDraft?.pullRequestNumber && nextDraft.repo) {
      await loadPullRequest(nextDraft.repo, nextDraft.pullRequestNumber);
    } else {
      setStatus(nextDraft?.previewBranch ? "Preview branch is ready for pull-request review." : "Save Draft and complete the real temporary preview first.");
    }
  }

  async function loadPullRequest(repo: string, number: number) {
    const params = new URLSearchParams({ repo, number: String(number) });
    const response = await fetch(`/api/v1/builder/pull-requests?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Unable to refresh pull request.");
    setPullRequest(data.pullRequest);
    setStatus(`Pull request #${data.pullRequest.number} · ${data.pullRequest.state} · checks ${data.pullRequest.checksPassed ? "passed" : "pending"}.`);
  }

  async function createPullRequest() {
    if (!canCreate || !draft) {
      setStatus("Pull request is blocked until a successful real preview, preview branch, and checkpoint are present.");
      return;
    }
    setBusy(true);
    setStatus("Creating reviewed pull request…");
    try {
      const response = await fetch("/api/v1/builder/pull-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          repo: draft.repo,
          baseBranch: draft.branch,
          headBranch: draft.previewBranch,
          title,
          previewUrl: draft.previewUrl,
          checkpointId: draft.checkpointId,
          filePath: draft.filePath,
          proofStatus: "preview-passed",
          verificationStatus: "pending-browser-verification",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false || !data.pullRequest) throw new Error(data.error || "Unable to create pull request.");
      setPullRequest(data.pullRequest);
      setDraft((current) => current ? { ...current, pullRequestNumber: data.pullRequest.number, pullRequestUrl: data.pullRequest.url } : current);
      setStatus(`${data.created ? "Created" : "Restored"} pull request #${data.pullRequest.number}. Merge remains gated by review and checks.`);
      window.dispatchEvent(new CustomEvent("streams-builder:pull-request-state", { detail: { phase: "github.pr.created", message: `Pull request #${data.pullRequest.number} is ready for review.`, repo: draft.repo, branch: draft.branch, previewBranch: draft.previewBranch, previewUrl: draft.previewUrl, checkpointId: draft.checkpointId, pullRequestNumber: data.pullRequest.number, pullRequestUrl: data.pullRequest.url, pullRequestState: data.pullRequest.state, checksPassed: data.pullRequest.checksPassed, approvalState: data.pullRequest.approvalState } }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create pull request.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadWorkspace().catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load reviewed change state."));
    function refresh() { void loadWorkspace().catch(() => {}); }
    window.addEventListener("streams-builder:preview-state", refresh);
    window.addEventListener("streams-builder:pull-request-state", refresh);
    return () => {
      window.removeEventListener("streams-builder:preview-state", refresh);
      window.removeEventListener("streams-builder:pull-request-state", refresh);
    };
  }, []);

  return (
    <section className="pullRequestReviewPanel" aria-label="Reviewed pull request workflow">
      <header><strong>Reviewed Pull Request</strong><span>Uses the verified temporary preview branch. Direct push remains available separately.</span></header>
      <dl>
        <div><dt>Repository</dt><dd>{draft?.repo || "none"}</dd></div>
        <div><dt>Base</dt><dd>{draft?.branch || "none"}</dd></div>
        <div><dt>Preview branch</dt><dd>{draft?.previewBranch || "none"}</dd></div>
        <div><dt>Preview</dt><dd>{draft?.previewBuildState || "not started"}</dd></div>
        <div><dt>Checkpoint</dt><dd>{draft?.checkpointId || "none"}</dd></div>
      </dl>
      <div className="pullRequestActions">
        <button type="button" onClick={createPullRequest} disabled={busy || !canCreate}>{busy ? "Working…" : pullRequest ? "Restore / Create PR" : "Create Pull Request"}</button>
        <button type="button" onClick={() => pullRequest && draft?.repo ? void loadPullRequest(draft.repo, pullRequest.number).catch((error) => setStatus(error instanceof Error ? error.message : "Refresh failed")) : void loadWorkspace()} disabled={busy}>Refresh Status</button>
        {pullRequest?.url ? <a href={pullRequest.url} target="_blank" rel="noreferrer">Open PR #{pullRequest.number}</a> : null}
      </div>
      {pullRequest ? <div className="pullRequestStatus"><span>State: {pullRequest.state}</span><span>Mergeable: {String(pullRequest.mergeable)}</span><span>Checks: {pullRequest.checksPassed ? "passed" : "pending or failed"}</span><span>Approval: {pullRequest.approvalState}</span><span>Merge allowed: {pullRequest.mergeAllowed ? "yes" : "no—review and checks required"}</span></div> : null}
      <p>{status}</p>
      <style jsx>{`.pullRequestReviewPanel{display:grid;gap:10px;padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#0b1424}.pullRequestReviewPanel header{display:grid;gap:3px}.pullRequestReviewPanel header strong{font-size:12px}.pullRequestReviewPanel header span,.pullRequestReviewPanel p,.pullRequestStatus span{font-size:9px;color:#94a3b8}.pullRequestReviewPanel dl{display:grid;gap:5px;margin:0}.pullRequestReviewPanel dl div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:8px}.pullRequestReviewPanel dt{font-size:9px;color:#6ee7b7}.pullRequestReviewPanel dd{margin:0;font-size:9px;color:#dbeafe;overflow-wrap:anywhere}.pullRequestActions{display:flex;flex-wrap:wrap;gap:6px}.pullRequestActions button,.pullRequestActions a{min-height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #3b82f6;border-radius:7px;background:#1d4ed8;color:#fff;font-size:9px;font-weight:900;padding:0 9px;text-decoration:none}.pullRequestActions button:disabled{opacity:.45}.pullRequestStatus{display:grid;gap:4px;padding:8px;border-radius:8px;background:#07101f}`}</style>
    </section>
  );
}
