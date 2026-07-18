"use client";

import { useEffect, useState } from "react";

type ActionType = "goto" | "click" | "fill" | "wait_for_selector" | "expect_text";
type ActionRow = { id: string; type: ActionType; selector: string; value: string; text: string; url: string };
type WorkspaceSnapshot = { projectId?: string; activeFile?: { route?: string } | null; draft?: { previewUrl?: string; checkpointId?: string; previewId?: string } | null };
type EvidenceAsset = { id: string; name: string; viewportName: string };
type VerificationResponse = { ok?: boolean; jobId?: string; error?: string; result?: { truthState?: string; proof?: string[]; unproven?: string[]; errors?: string[]; consoleMessages?: string[]; networkFailures?: string[] }; evidenceAssets?: EvidenceAsset[] };

function newAction(type: ActionType = "wait_for_selector"): ActionRow {
  return { id: crypto.randomUUID(), type, selector: type === "wait_for_selector" ? "body" : "", value: "", text: "", url: "" };
}

function toApiAction(row: ActionRow) {
  if (row.type === "goto") return { type: row.type, url: row.url };
  if (row.type === "fill") return { type: row.type, selector: row.selector, value: row.value };
  if (row.type === "expect_text") return { type: row.type, selector: row.selector, text: row.text };
  return { type: row.type, selector: row.selector };
}

export default function BrowserVerificationPanel() {
  const [projectId, setProjectId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [route, setRoute] = useState("");
  const [checkpointId, setCheckpointId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [actions, setActions] = useState<ActionRow[]>([newAction()]);
  const [status, setStatus] = useState("Restoring verified preview state…");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const projectResponse = await fetch("/api/streams-ai/projects", { cache: "no-store" });
        const projectData = await projectResponse.json() as { project?: { id?: string } };
        const id = String(projectData.project?.id || "");
        if (!id) throw new Error("No active Streams project was found.");
        const stateResponse = await fetch(`/api/streams-builder/workspace-state?projectId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const stateData = await stateResponse.json() as { snapshot?: WorkspaceSnapshot | null };
        if (cancelled) return;
        const snapshot = stateData.snapshot;
        setProjectId(id);
        setTargetUrl(String(snapshot?.draft?.previewUrl || ""));
        setCheckpointId(String(snapshot?.draft?.checkpointId || ""));
        setPreviewId(String(snapshot?.draft?.previewId || ""));
        setRoute(String(snapshot?.activeFile?.route || ""));
        setStatus(snapshot?.draft?.previewUrl ? "Verified preview restored. Configure actions and run desktop/mobile proof." : "Create a successful temporary preview before browser verification.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to restore browser verification state.");
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  function updateAction(id: string, patch: Partial<ActionRow>) {
    setActions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function runVerification() {
    setRunning(true);
    setResult(null);
    setStatus("Running real Playwright verification on desktop and mobile…");
    try {
      const response = await fetch("/api/streams-builder/browser-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ projectId, sessionId: "streams-builder", targetUrl, route, checkpointId, previewId, actions: actions.map(toApiAction) }),
      });
      const data = await response.json() as VerificationResponse;
      setResult(data);
      const truthState = String(data.result?.truthState || (response.ok ? "UNPROVEN" : "FAILED"));
      setStatus(`Browser verification ${truthState}.`);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: {
        phase: truthState === "PROVEN" ? "verification.passed" : truthState === "FAILED" ? "verification.failed" : "verification.in_review",
        message: `Desktop and mobile browser verification ${truthState}.`,
        verificationStatus: truthState,
        verificationJobId: data.jobId || "",
        evidenceAssetIds: (data.evidenceAssets || []).map((asset) => asset.id),
        checkpointId,
        previewId,
        previewUrl: targetUrl,
      } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Browser verification failed.";
      setResult({ ok: false, error: message });
      setStatus(message);
    } finally {
      setRunning(false);
    }
  }

  const canRun = Boolean(projectId && targetUrl && checkpointId && previewId && actions.length && actions.length <= 25);

  return (
    <section className="browserVerificationPanel" aria-label="Browser verification evidence">
      <header><b>Real Browser Verification</b><span>{status}</span></header>
      <div className="verificationContext">
        <label>Preview URL<input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://preview.vercel.app/route" /></label>
        <label>Route<input value={route} onChange={(event) => setRoute(event.target.value)} placeholder="/streams-ai/streams-builder" /></label>
        <label>Checkpoint<input value={checkpointId} readOnly /></label>
        <label>Preview ID<input value={previewId} readOnly /></label>
      </div>
      <div className="actionHeader"><b>Verification actions</b><button type="button" onClick={() => setActions((items) => [...items, newAction("click")])} disabled={actions.length >= 25}>+ Add action</button></div>
      <div className="actionRows">
        {actions.map((action, index) => (
          <div className="actionRow" key={action.id}>
            <span>{index + 1}</span>
            <select value={action.type} onChange={(event) => updateAction(action.id, { type: event.target.value as ActionType, selector: "", value: "", text: "", url: "" })}>
              <option value="wait_for_selector">Wait for selector</option><option value="click">Click</option><option value="fill">Fill</option><option value="expect_text">Expect text</option><option value="goto">Go to URL</option>
            </select>
            {action.type === "goto" ? <input value={action.url} onChange={(event) => updateAction(action.id, { url: event.target.value })} placeholder="Safe preview URL" /> : <input value={action.selector} onChange={(event) => updateAction(action.id, { selector: event.target.value })} placeholder="CSS selector" />}
            {action.type === "fill" ? <input value={action.value} onChange={(event) => updateAction(action.id, { value: event.target.value })} placeholder="Value" /> : null}
            {action.type === "expect_text" ? <input value={action.text} onChange={(event) => updateAction(action.id, { text: event.target.value })} placeholder="Expected text" /> : null}
            <button type="button" aria-label={`Remove action ${index + 1}`} onClick={() => setActions((items) => items.filter((item) => item.id !== action.id))} disabled={actions.length === 1}>×</button>
          </div>
        ))}
      </div>
      <button className="runVerification" type="button" onClick={runVerification} disabled={!canRun || running}>{running ? "Verifying desktop + mobile…" : "Run Desktop + Mobile Verification"}</button>
      {result ? <div className="verificationResult">
        <b>{result.result?.truthState || "FAILED"}</b>
        {result.error ? <span>{result.error}</span> : null}
        {(result.result?.proof || []).map((item) => <span key={`proof-${item}`}>✓ {item}</span>)}
        {(result.result?.unproven || []).map((item) => <span key={`unproven-${item}`}>Review: {item}</span>)}
        {(result.result?.errors || []).map((item) => <span key={`error-${item}`}>Error: {item}</span>)}
        {(result.evidenceAssets || []).map((asset) => <span key={asset.id}>Evidence: {asset.viewportName} · {asset.name} · {asset.id}</span>)}
        {(result.result?.consoleMessages || []).map((item) => <span key={`console-${item}`}>Console: {item}</span>)}
        {(result.result?.networkFailures || []).map((item) => <span key={`network-${item}`}>Network: {item}</span>)}
      </div> : null}
      <style jsx>{`.browserVerificationPanel{display:grid;gap:10px;margin-top:10px;padding:10px;border:1px solid rgba(59,130,246,.35);border-radius:10px;background:#07101f;color:#e2e8f0}.browserVerificationPanel header{display:grid;gap:3px}.browserVerificationPanel header b,.actionHeader b{color:#93c5fd}.browserVerificationPanel header span{font-size:10px;color:#cbd5e1}.verificationContext{display:grid;grid-template-columns:1fr 1fr;gap:8px}.verificationContext label{display:grid;gap:3px;font-size:9px;color:#94a3b8}.verificationContext input,.actionRow input,.actionRow select{min-width:0;height:30px;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;padding:0 8px;font-size:10px}.actionHeader{display:flex;align-items:center;justify-content:space-between}.actionHeader button,.actionRow button,.runVerification{border:1px solid #3b82f6;border-radius:7px;background:#1d4ed8;color:#fff;font-weight:800;cursor:pointer}.actionHeader button{height:28px}.actionRows{display:grid;gap:6px}.actionRow{display:grid;grid-template-columns:22px 145px minmax(120px,1fr) minmax(100px,1fr) auto;gap:6px;align-items:center}.actionRow>span{font-size:10px;color:#94a3b8}.actionRow button{height:28px;width:28px;background:#7f1d1d;border-color:#ef4444}.runVerification{height:36px}.runVerification:disabled,.actionHeader button:disabled,.actionRow button:disabled{opacity:.45;cursor:not-allowed}.verificationResult{display:grid;gap:4px;padding:8px;border-radius:8px;background:#020617;font-size:9px}.verificationResult b{color:#6ee7b7}.verificationResult span{overflow-wrap:anywhere}@media(max-width:760px){.verificationContext{grid-template-columns:1fr}.actionRow{grid-template-columns:20px 1fr 28px}.actionRow input{grid-column:2}.actionRow button{grid-column:3;grid-row:1}}`}</style>
    </section>
  );
}
