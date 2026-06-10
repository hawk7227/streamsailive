"use client";

import { useMemo, useState } from "react";
import type { StreamsBuilderBridgeState } from "@/lib/streams-builder/types";
import type { ReviewDecision, ReviewTruthState } from "@/lib/streams-builder/review-types";

type BrowserResult = {
  ok: boolean;
  jobId?: string;
  result?: {
    truthState: ReviewTruthState;
    proof: string[];
    unproven: string[];
    errors: string[];
    consoleMessages: string[];
    networkFailures: string[];
  };
  error?: string;
};

type GateResult = {
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

const statusOptions: ReviewTruthState[] = ["UNPROVEN", "PROVEN", "FAILED", "WAITING_FOR_USER"];

function StatusSelect({ label, value, onChange }: { label: string; value: ReviewTruthState; onChange: (next: ReviewTruthState) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ReviewTruthState)}
        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
    </label>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <h4 className="mb-2 text-sm font-black text-white">{title}</h4>
      {items.length ? (
        <ul className="grid gap-2 text-xs leading-5 text-slate-300">
          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">None reported.</p>
      )}
    </section>
  );
}

export default function StreamsBuilderControlPanel({ bridge }: { bridge: StreamsBuilderBridgeState }) {
  const [previewUrl, setPreviewUrl] = useState(bridge.sourceTruth.previewUrl || "");
  const [route, setRoute] = useState(bridge.sourceTruth.route || "");
  const [component, setComponent] = useState(bridge.sourceTruth.component || "");
  const [file, setFile] = useState(bridge.sourceTruth.file || "");
  const [githubPath, setGithubPath] = useState(bridge.sourceTruth.githubPath || "");
  const [buildStatus, setBuildStatus] = useState<ReviewTruthState>("UNPROVEN");
  const [proofStatus, setProofStatus] = useState<ReviewTruthState>("UNPROVEN");
  const [browserStatus, setBrowserStatus] = useState<ReviewTruthState>("UNPROVEN");
  const [workflowStatus, setWorkflowStatus] = useState<ReviewTruthState>("UNPROVEN");
  const [comment, setComment] = useState("");
  const [running, setRunning] = useState(false);
  const [browserResult, setBrowserResult] = useState<BrowserResult | null>(null);
  const [gateResult, setGateResult] = useState<GateResult | null>(null);

  const commonPayload = useMemo(() => ({
    projectId: bridge.project.projectId,
    sessionId: bridge.session.sessionId,
    previewUrl,
    route,
    component,
    file,
    githubPath,
    buildStatus,
    proofStatus,
    browserVerificationStatus: browserStatus,
    workflowVerificationStatus: workflowStatus,
  }), [bridge.project.projectId, bridge.session.sessionId, previewUrl, route, component, file, githubPath, buildStatus, proofStatus, browserStatus, workflowStatus]);

  async function runBrowserVerification() {
    setRunning(true);
    setBrowserResult(null);
    try {
      const response = await fetch("/api/streams-builder/browser-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: bridge.project.projectId,
          sessionId: bridge.session.sessionId,
          targetUrl: previewUrl,
          route,
          actions: [{ type: "wait_for_selector", selector: "body" }],
        }),
      });
      const json = (await response.json()) as BrowserResult;
      setBrowserResult(json);
      if (json.result?.truthState) setBrowserStatus(json.result.truthState);
    } catch (error) {
      setBrowserResult({ ok: false, error: error instanceof Error ? error.message : "Browser verification failed" });
      setBrowserStatus("FAILED");
    } finally {
      setRunning(false);
    }
  }

  async function submitDecision(decision: ReviewDecision) {
    setRunning(true);
    setGateResult(null);
    try {
      const response = await fetch("/api/streams-builder/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...commonPayload, decision, comment }),
      });
      const json = (await response.json()) as GateResult;
      setGateResult(json);
    } catch (error) {
      setGateResult({ ok: false, error: error instanceof Error ? error.message : "Live decision failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Browser Verification + Live Approval</p>
          <h2 className="mt-2 text-2xl font-black text-white">Approve only what is running and proven.</h2>
        </div>
        <button
          type="button"
          onClick={runBrowserVerification}
          disabled={running || !previewUrl}
          className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Run Browser Verification
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-200">
          Live Preview URL
          <input value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-200">
          Route
          <input value={route} onChange={(event) => setRoute(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-200">
          Component
          <input value={component} onChange={(event) => setComponent(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-200">
          Source File / GitHub Path
          <input value={githubPath || file} onChange={(event) => { setGithubPath(event.target.value); setFile(event.target.value); }} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <StatusSelect label="Build" value={buildStatus} onChange={setBuildStatus} />
        <StatusSelect label="Proof" value={proofStatus} onChange={setProofStatus} />
        <StatusSelect label="Browser" value={browserStatus} onChange={setBrowserStatus} />
        <StatusSelect label="Workflow" value={workflowStatus} onChange={setWorkflowStatus} />
      </div>

      <label className="mt-5 grid gap-2 text-sm font-bold text-slate-200">
        Comment / Requested Changes
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
      </label>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <button type="button" onClick={() => submitDecision("approve")} disabled={running} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">Approve Live Frontend</button>
        <button type="button" onClick={() => submitDecision("request_changes")} disabled={running} className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">Request Changes</button>
        <button type="button" onClick={() => submitDecision("comment")} disabled={running} className="rounded-2xl border border-slate-600 px-5 py-3 text-sm font-black text-slate-100 disabled:text-slate-500">Comment</button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ListBlock title="Browser Proof" items={browserResult?.result?.proof || []} />
        <ListBlock title="Browser Unproven / Errors" items={[...(browserResult?.result?.unproven || []), ...(browserResult?.result?.errors || []), ...(browserResult?.error ? [browserResult.error] : [])]} />
        <ListBlock title="Approval Proof" items={gateResult?.result?.proof || []} />
        <ListBlock title="Approval Blockers" items={[...(gateResult?.result?.blockedReasons || []), ...(gateResult?.result?.unproven || []), ...(gateResult?.error ? [gateResult.error] : [])]} />
      </div>
    </section>
  );
}
