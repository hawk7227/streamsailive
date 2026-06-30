"use client";

import { useEffect, useState } from "react";

function readActiveFile() {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function VisualSelectionPatchPanel() {
  const [selection, setSelection] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onMessage(event) {
      const detail = event.data || {};
      if (detail.event !== "streams:visual-selection") return;
      setSelection(detail);
      setPlan(null);
      setError("");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function generatePatch(approve = false) {
    const activeFile = readActiveFile();
    if (!activeFile?.path || !activeFile?.content) {
      setError("No active source file is loaded. Pull/open the source file first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/streams-builder/visual-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: activeFile.repo,
          branch: activeFile.branch,
          files: [{ path: activeFile.path, content: activeFile.content, repo: activeFile.repo, branch: activeFile.branch, sha: activeFile.sha, route: activeFile.route }],
          selection,
          command: "remove this",
          approve,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Visual edit failed");
      setPlan(data);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: approve ? "visual-edit-commit" : "visual-edit-plan", message: approve ? `Visual edit committed: ${data.commits?.[0]?.commitSha || "pending"}` : `Visual edit plan ready with ${data.result?.resolved?.confidence || 0}% confidence.` } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visual edit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!selection) return null;
  const resolved = plan?.result?.resolved;
  const patchCount = plan?.result?.patches?.length || 0;
  return (
    <aside className="visualPatchPanel">
      <header><b>Visual Selection</b><button type="button" onClick={() => { setSelection(null); setPlan(null); }}>×</button></header>
      <div className="body">
        <p><span>Selected</span><b>{selection.text || selection.parentText || selection.selector || "Element"}</b></p>
        <p><span>Fingerprint</span><b>{selection.sourceFile || "not embedded"}</b></p>
        {resolved ? <p><span>Resolved</span><b>{resolved.sourceFile || "unknown"} · {resolved.targetType} · {resolved.confidence}%</b></p> : null}
        {resolved?.reasons?.length ? <ul>{resolved.reasons.slice(0, 5).map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
        {error ? <p className="error">{error}</p> : null}
        {patchCount ? <pre>{plan.result.patches[0].patch.slice(0, 3000)}</pre> : null}
      </div>
      <footer>
        <button type="button" disabled={busy} onClick={() => generatePatch(false)}>{busy ? "Working…" : "Plan remove"}</button>
        <button type="button" disabled={busy || !patchCount} onClick={() => generatePatch(true)}>Apply + Push</button>
      </footer>
      <style jsx>{`.visualPatchPanel{position:fixed;left:18px;bottom:18px;z-index:120;width:min(460px,calc(100vw - 36px));border:1px solid rgba(55,229,255,.38);border-radius:18px;background:#081126;color:#eaf3ff;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}header{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid rgba(148,163,184,.18)}header b{font-size:12px}header button{border:0;background:rgba(255,255,255,.08);color:white;border-radius:999px;width:28px;height:28px}.body{padding:12px;display:grid;gap:8px;max-height:420px;overflow:auto}.body p{margin:0;display:grid;gap:2px}.body span{color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.body b{font-size:12px;line-height:1.35;overflow-wrap:anywhere}.body ul{margin:0;padding-left:18px;color:#a9b8d9;font-size:11px}.error{color:#fecaca!important}pre{white-space:pre-wrap;max-height:180px;overflow:auto;background:#020617;border-radius:12px;padding:10px;color:#cbd5e1;font-size:10px}footer{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(148,163,184,.18)}footer button{flex:1;height:34px;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:900;font-size:12px}footer button:disabled{opacity:.55}`}</style>
    </aside>
  );
}
