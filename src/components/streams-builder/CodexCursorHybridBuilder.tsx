"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BuilderChatConnection, PulledFileDetail } from "./builderSystemContract";

type Props = {
  activeFile: PulledFileDetail;
  connection: BuilderChatConnection;
  onProof: (message: string) => void;
};

type RuntimeEvent = {
  id?: string | number;
  eventType?: string;
  event_type?: string;
  message?: string;
  createdAt?: string;
  created_at?: string;
};

type RuntimePlan = {
  readiness?: { ready?: boolean; missing?: string[] };
  requiredCapabilities?: string[];
  commandPolicies?: Array<{ command?: string; risk?: string; reason?: string }>;
  iPhonePrompt?: string;
};

function eventKey(event: RuntimeEvent) {
  return String(event.id || `${event.eventType || event.event_type}:${event.message}:${event.createdAt || event.created_at}`);
}

function projectId() {
  try { return window.localStorage.getItem("streams-ai:active-project-id") || "project-pending"; } catch { return "project-pending"; }
}

export default function CodexCursorHybridBuilder({ activeFile, connection, onProof }: Props) {
  const [prompt, setPrompt] = useState("Inspect the current source, repair failures autonomously, rerun verification, and stop before push for approval.");
  const [plan, setPlan] = useState<RuntimePlan | null>(null);
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("Hybrid runtime ready");
  const [events, setEvents] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const targetFiles = useMemo(() => activeFile.path ? [activeFile.path] : [], [activeFile.path]);
  const ready = Boolean(activeFile.repo && activeFile.branch && activeFile.path && connection.sessionId && connection.sessionId !== "agent-1");

  async function analyze() {
    if (!ready) { setStatus("Select a source file and keep the originating chat session connected."); return; }
    setRunning(true);
    setStatus("Building Codex/Cursor hybrid execution plan…");
    try {
      const response = await fetch("/api/streams-builder/codex-best-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userPrompt: prompt,
          repoFullName: activeFile.repo,
          branchName: activeFile.branch,
          route: activeFile.route || "/",
          targetFiles,
          requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"],
          autonomousRepair: true,
          maxRepairAttempts: 3,
          requireApprovalBeforePush: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Best-builder analysis failed.");
      setPlan(payload.metadata || null);
      setStatus("Plan ready: source truth → sandbox → build → repair loop → proof → approval gate.");
      onProof("Codex/Cursor hybrid best-builder plan created for the active source.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Best-builder analysis failed.");
    } finally { setRunning(false); }
  }

  async function run() {
    if (!ready) { setStatus("Select a source file and keep the originating chat session connected."); return; }
    setRunning(true);
    setStatus("Queueing autonomous repair worker…");
    setEvents([]);
    seen.current = new Set();
    try {
      const response = await fetch("/api/streams-builder/repository-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          projectId: projectId(),
          sessionId: connection.sessionId,
          repoFullName: activeFile.repo,
          branchName: activeFile.branch,
          route: activeFile.route || "/",
          userPrompt: prompt,
          targetFiles,
          requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"],
          enqueue: true,
          autoRunWorker: true,
          autonomousRepair: true,
          maxRepairAttempts: 3,
          maxFilesTouched: 6,
          runBuildAfterPatch: true,
          requireApprovalBeforePush: true,
          approvalGranted: false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || payload?.message || "Autonomous worker could not be queued.");
      const id = String(payload?.queuedJob?.id || "");
      if (!id) throw new Error("Repository worker returned no job ID.");
      setJobId(id);
      setStatus(`Autonomous hybrid worker queued: ${id}`);
      window.dispatchEvent(new CustomEvent("streams-builder:runtime-job", { detail: { jobId: id, repo: activeFile.repo, branch: activeFile.branch, path: activeFile.path, route: activeFile.route, prompt } }));
      onProof(`Codex/Cursor hybrid autonomous worker queued: ${id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Autonomous worker failed to start.");
    } finally { setRunning(false); }
  }

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    async function poll() {
      try {
        const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store", credentials: "same-origin" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Runtime proof unavailable.");
        if (stopped) return;
        const jobStatus = String(payload?.job?.status || "running");
        setStatus(`Hybrid runtime ${jobStatus}`);
        for (const event of Array.isArray(payload?.events) ? payload.events : []) {
          const key = eventKey(event);
          if (seen.current.has(key)) continue;
          seen.current.add(key);
          setEvents((items) => [...items.slice(-39), `${event.eventType || event.event_type || "runtime"}: ${event.message || "event"}`]);
        }
      } catch (error) {
        if (!stopped) setStatus(error instanceof Error ? error.message : "Runtime proof unavailable.");
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [jobId]);

  return (
    <section className="hybridBuilder" aria-label="Codex Cursor hybrid autonomous builder">
      <header><div><b>Codex × Cursor Hybrid Best Builder</b><span>source-aware agent + bounded autonomous repair + proof-gated GitHub writes</span></div><strong>{status}</strong></header>
      <div className="hybridGrid">
        <article className="controls">
          <textarea value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} aria-label="Hybrid builder instruction" />
          <div className="actions"><button type="button" onClick={analyze} disabled={running || !ready}>Analyze plan</button><button type="button" className="run" onClick={run} disabled={running || !ready}>Run autonomous repair loop</button></div>
          <p>Repo: <b>{activeFile.repo || "not selected"}</b></p><p>Branch: <b>{activeFile.branch || "not selected"}</b></p><p>File: <b>{activeFile.path || "not selected"}</b></p><p>Session: <b>{connection.sessionId || "not connected"}</b></p>
        </article>
        <article className="plan"><b>Hybrid execution contract</b>{plan ? <><p>Readiness: {plan.readiness?.ready ? "ready" : "blocked"}</p><p>{(plan.requiredCapabilities || []).slice(0, 5).join(" · ") || "Capabilities resolved by runtime"}</p>{(plan.commandPolicies || []).map((item) => <p key={item.command}>{item.command}: {item.risk} — {item.reason}</p>)}</> : <p>Analyze to load the researched best-builder orchestration, command policy, rollback, browser proof, and approval gates.</p>}</article>
        <article className="proof"><b>Live runtime / repair proof</b>{events.length ? events.map((item, index) => <p key={`${index}-${item}`}>{item}</p>) : <p>No worker events yet.</p>}</article>
      </div>
      <style jsx>{`.hybridBuilder{border-top:1px solid rgba(45,212,191,.35);background:#020617;color:#cbd5e1;padding:8px;display:grid;gap:8px}.hybridBuilder header{display:flex;justify-content:space-between;gap:12px;align-items:center}.hybridBuilder header div{display:grid}.hybridBuilder header b{color:#99f6e4;font-size:12px}.hybridBuilder header span{font-size:10px;color:#94a3b8}.hybridBuilder header strong{font-size:10px;color:#c4b5fd}.hybridGrid{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(300px,1fr) minmax(300px,1.1fr);gap:8px;min-height:150px}.hybridGrid article{min-width:0;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#0f172a;padding:8px;overflow:auto}.controls textarea{width:100%;min-height:62px;resize:vertical;box-sizing:border-box;border:1px solid rgba(124,58,237,.5);border-radius:8px;background:#020617;color:#fff;padding:8px;font:11px/1.4 inherit}.actions{display:flex;gap:6px;margin:6px 0}.actions button{border:1px solid rgba(110,231,183,.5);border-radius:8px;background:#064e3b;color:#d1fae5;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer}.actions button.run{background:#6d28d9}.actions button:disabled{opacity:.45;cursor:not-allowed}.hybridGrid b{color:#fff;font-size:11px}.hybridGrid p{margin:5px 0;font-size:10px;line-height:1.35;color:#94a3b8;overflow-wrap:anywhere}.proof p{border-left:3px solid #22c55e;padding-left:7px;color:#cbd5e1}@media(max-width:1200px){.hybridGrid{grid-template-columns:1fr}.hybridBuilder{max-height:360px;overflow:auto}}`}</style>
    </section>
  );
}
