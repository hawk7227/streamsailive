"use client";

import { useEffect, useRef, useState } from "react";

function readActiveFile() {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeEditablePayload(message) {
  const payload = message?.payload || message || {};
  const type = message?.type || payload?.event || "";
  if (payload.event === "streams:visual-selection") return payload;
  if (message?.source !== "streams-editable-preview") return null;
  if (!/^streams-editable-(select|remove|delete|image-replace|style|transform-start)$/.test(type)) return null;
  return {
    event: "streams:visual-selection",
    selectionId: payload.id || payload.layerId || `sel_${Date.now()}`,
    tag: payload.kind || "element",
    text: payload.text || "",
    parentText: [payload.text, ...(payload.childLayers || []).map((child) => child.text)].filter(Boolean).join(" "),
    href: payload.href || "",
    imageSrc: payload.src || payload.original || "",
    selector: payload.selector || "",
    sourceFile: payload.sourceFile || "",
    component: payload.component || "",
    symbol: payload.symbol || "",
    itemKey: payload.itemKey || payload.href || payload.src || "",
    operationTarget: payload.operationTarget || payload.kind || "",
    box: { width: payload.width || 0, height: payload.height || 0 },
    raw: payload,
    source: "editable-preview",
    actionType: type,
  };
}

function focusedPreview(patch, resolved) {
  const before = String(patch?.before || "");
  const range = resolved?.item?.range;
  if (!before || !range?.startLine || !range?.endLine) return String(patch?.patch || "").slice(0, 2200);
  const lines = before.split("\n");
  const start = Math.max(1, range.startLine - 4);
  const end = Math.min(lines.length, range.endLine + 4);
  const out = [`Focused removal preview · ${patch.file}`, `@@ ${start},${end - start + 1} @@`];
  for (let lineNo = start; lineNo <= end; lineNo += 1) {
    const isTarget = lineNo >= range.startLine && lineNo <= range.endLine;
    out.push(`${isTarget ? "-" : " "}${String(lineNo).padStart(4, " ")} ${lines[lineNo - 1] || ""}`);
  }
  return out.join("\n");
}

export default function VisualSelectionPatchPanel() {
  const [selection, setSelection] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastAutoPlanRef = useRef("");

  async function generatePatch(approve = false, explicitSelection = selection) {
    const activeFile = readActiveFile();
    if (!activeFile?.path || !activeFile?.content) {
      setError("No active source file is loaded. Pull/open the source file first.");
      return;
    }
    if (!explicitSelection) return;
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
          selection: explicitSelection,
          command: "remove this",
          approve,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || data?.result?.error || "Visual edit failed");
      setPlan(data);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: approve ? "visual-edit-commit" : "visual-edit-plan", message: approve ? `Visual edit committed: ${data.commits?.[0]?.commitSha || "pending"}` : `Visual edit resolved with ${data.result?.resolved?.confidence || 0}% confidence across ${(data.indexedFiles || []).length || 1} indexed files.` } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Visual edit failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onMessage(event) {
      const normalized = normalizeEditablePayload(event.data || {});
      if (!normalized) return;
      setSelection(normalized);
      setPlan(null);
      setError("");
      const key = `${normalized.selectionId || ""}:${normalized.imageSrc || ""}:${normalized.text || ""}:${normalized.selector || ""}`;
      if (key !== lastAutoPlanRef.current) {
        lastAutoPlanRef.current = key;
        window.setTimeout(() => generatePatch(false, normalized), 0);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!selection) return null;
  const resolved = plan?.result?.resolved;
  const patch = plan?.result?.patches?.[0] || null;
  const indexedFiles = plan?.indexedFiles || [];
  const item = resolved?.item || {};
  const summary = {
    operation: patch?.operation || "remove-array-item",
    target: item.arrayName ? `${item.arrayName} item` : resolved?.targetType || "visual selection",
    file: resolved?.sourceFile || patch?.file || "not resolved yet",
    image: item.image || selection.imageSrc || "",
    href: item.href || selection.href || "",
    confidence: resolved?.confidence || 0,
  };

  return (
    <aside className="visualPatchPanel">
      <header><b>Selection → Patch</b><button type="button" onClick={() => { setSelection(null); setPlan(null); }}>×</button></header>
      <div className="body">
        <p><span>Selected</span><b>{selection.text || selection.parentText || selection.imageSrc || selection.selector || "Element"}</b></p>
        <p><span>Clicked source</span><b>{selection.sourceFile || selection.selector || "editable preview DOM"}</b></p>
        {busy && !plan ? <p><span>Status</span><b>Resolving source automatically…</b></p> : null}
        {indexedFiles.length ? <p><span>Indexed files</span><b>{indexedFiles.slice(0, 5).join(" · ")}{indexedFiles.length > 5 ? ` +${indexedFiles.length - 5}` : ""}</b></p> : null}
        {resolved ? (
          <section className="summaryCard">
            <p><span>Operation</span><b>{summary.operation}</b></p>
            <p><span>Target</span><b>{summary.target}</b></p>
            <p><span>File</span><b>{summary.file}</b></p>
            {summary.image ? <p><span>Matched image</span><b>{summary.image}</b></p> : null}
            {summary.href ? <p><span>Matched href</span><b>{summary.href}</b></p> : null}
            <p><span>Confidence</span><b>{summary.confidence}%</b></p>
          </section>
        ) : null}
        {resolved?.reasons?.length ? <ul>{resolved.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
        {error ? <p className="error">{error}</p> : null}
        {plan?.result?.error ? <p className="error">{plan.result.error}</p> : null}
        {patch ? <pre>{focusedPreview(patch, resolved)}</pre> : null}
      </div>
      <footer>
        <button type="button" disabled={busy} onClick={() => generatePatch(false)}>{busy ? "Working…" : "Re-plan"}</button>
        <button type="button" disabled={busy || !patch} onClick={() => generatePatch(true)}>Apply + Push</button>
      </footer>
      <style jsx>{`.visualPatchPanel{position:fixed;right:18px;top:132px;bottom:auto;left:auto;z-index:2147483000;width:min(520px,calc(100vw - 36px));max-height:calc(100dvh - 170px);border:1px solid rgba(55,229,255,.38);border-radius:18px;background:#081126;color:#eaf3ff;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}header{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid rgba(148,163,184,.18)}header b{font-size:12px}header button{border:0;background:rgba(255,255,255,.08);color:white;border-radius:999px;width:28px;height:28px}.body{padding:12px;display:grid;gap:8px;max-height:calc(100dvh - 260px);overflow:auto}.body p{margin:0;display:grid;gap:2px}.body span{color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.body b{font-size:12px;line-height:1.35;overflow-wrap:anywhere}.summaryCard{display:grid;gap:8px;border:1px solid rgba(110,231,183,.28);border-radius:14px;background:rgba(6,78,59,.18);padding:10px}.body ul{margin:0;padding-left:18px;color:#a9b8d9;font-size:11px}.error{color:#fecaca!important}pre{white-space:pre-wrap;max-height:190px;overflow:auto;background:#020617;border-radius:12px;padding:10px;color:#cbd5e1;font-size:10px}footer{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(148,163,184,.18)}footer button{flex:1;height:34px;border:0;border-radius:10px;background:#7c3aed;color:white;font-weight:900;font-size:12px}footer button:disabled{opacity:.55}@media(max-width:980px){.visualPatchPanel{right:10px;left:10px;top:96px;width:auto}}`}</style>
    </aside>
  );
}
