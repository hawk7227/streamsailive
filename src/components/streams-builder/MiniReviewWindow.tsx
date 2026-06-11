"use client";

import { useState } from "react";
import type { StreamsBuilderProjectView } from "@/lib/streams-builder/projects";
import type { ReviewDecision, ReviewTruthState } from "@/lib/streams-builder/review-types";

type GateResponse = {
  ok: boolean;
  result?: {
    truthState: ReviewTruthState;
    reviewState: string;
    blockedReasons: string[];
    proof: string[];
    unproven: string[];
  };
  error?: string;
};

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-950 p-3">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="break-words text-sm font-bold text-slate-100">{value || "UNPROVEN"}</span>
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <h4 className="mb-2 text-sm font-black text-white">{title}</h4>
      {items.length ? <ul className="grid gap-1 text-xs text-slate-300">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="text-xs text-slate-500">None.</p>}
    </section>
  );
}

export default function MiniReviewWindow({ project, onActivity }: { project: StreamsBuilderProjectView | null; onActivity: () => void }) {
  const [comment, setComment] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GateResponse | null>(null);

  if (!project) {
    return (
      <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
        <h2 className="text-xl font-black text-white">Mini review window</h2>
        <p className="mt-3 text-sm text-slate-400">Select a real project thumbnail to review.</p>
      </section>
    );
  }

  async function submitDecision(decision: ReviewDecision) {
    if (!project) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/streams-builder/gate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.projectId,
          sessionId: project.jobId || project.projectId,
          previewUrl: project.activePreviewUrl || "",
          route: project.activeRoute || undefined,
          component: project.component || undefined,
          file: project.file || undefined,
          githubPath: project.githubPath || undefined,
          buildStatus: project.latestJobState === "completed" ? "PROVEN" : "UNPROVEN",
          proofStatus: project.proofState,
          browserVerificationStatus: project.proofState,
          workflowVerificationStatus: project.approvalState === "approved" ? "PROVEN" : "UNPROVEN",
          decision,
          comment,
        }),
      });
      const json = (await response.json()) as GateResponse;
      setResult(json);
      await fetch("/api/streams-builder/activity-log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.projectId,
          sessionId: project.jobId || project.projectId,
          actionType: `mini_review_${decision}`,
          previousState: project.approvalState,
          nextState: json.result?.reviewState || "UNPROVEN",
          truthState: json.result?.truthState || "UNPROVEN",
          message: comment || `Mini review ${decision}`,
        }),
      });
      onActivity();
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Mini review failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Mini review</p>
          <h2 className="mt-1 text-2xl font-black text-white">{project.name}</h2>
          <p className="mt-2 text-sm text-slate-400">Approve only what has real proof. Missing data stays UNPROVEN.</p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-black text-slate-300">{project.approvalState}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-3">
          {project.activePreviewUrl ? (
            <iframe title={`Preview ${project.name}`} src={project.activePreviewUrl} className="h-[420px] w-full rounded-2xl border border-slate-700 bg-white" />
          ) : (
            <div className="grid h-[420px] place-items-center rounded-2xl border border-dashed border-slate-700 text-center text-sm text-slate-400">
              <div>
                <p className="font-black text-amber-200">Preview URL missing.</p>
                <p className="mt-2">Preview thumbnail pending proof artifact.</p>
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3">
          <Detail label="Route" value={project.activeRoute} />
          <Detail label="Component" value={project.component} />
          <Detail label="File" value={project.file} />
          <Detail label="GitHub Path" value={project.githubPath} />
          <Detail label="Job ID" value={project.jobId} />
          <Detail label="Checkpoint" value={project.checkpointId} />
          <Detail label="Proof" value={project.proofState} />
          <Detail label="Approval" value={project.approvalState} />
        </div>
      </div>

      <label className="mt-5 grid gap-2 text-sm font-bold text-slate-200">
        Comment / requested changes
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400" />
      </label>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <button type="button" disabled={running} onClick={() => submitDecision("approve")} className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">Approve</button>
        <button type="button" disabled={running} onClick={() => submitDecision("request_changes")} className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">Request Changes</button>
        <button type="button" disabled={running} onClick={() => submitDecision("comment")} className="rounded-2xl border border-slate-600 px-5 py-3 text-sm font-black text-white disabled:text-slate-500">Comment</button>
      </div>

      {result ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ResultList title="Proof" items={result.result?.proof || []} />
          <ResultList title="Blockers / Unproven" items={[...(result.result?.blockedReasons || []), ...(result.result?.unproven || []), ...(result.error ? [result.error] : [])]} />
        </div>
      ) : null}
    </section>
  );
}
