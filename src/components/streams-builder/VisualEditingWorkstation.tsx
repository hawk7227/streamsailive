"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  stationLabel: string;
  route: string;
  filePath: string;
  repo: string;
  branch: string;
  content: string;
  onContentChange: (next: string) => void;
  onProof: (message: string) => void;
  onChat: (message: string) => void;
};

type ViewMode = "editor" | "browser" | "mobile" | "advanced";
type PatchState = "not_generated" | "generated" | "approved" | "pushed" | "failed";
type EditEvent = { id?: string; kind?: string; selector?: string; original?: string; text?: string; src?: string; replacementDataUrl?: string; replacementName?: string; inlineStyle?: string; width?: number; height?: number; transform?: string };
type LinePatchResult = { ok?: boolean; pushed?: boolean; error?: string; preview?: { ok?: boolean; changedLineCount?: number; nextContent?: string; errors?: string[]; audit?: string[] }; pushResult?: { commit?: { sha?: string } } };

function normalizeRoute(value: string) { const trimmed = (value || "/").trim(); return trimmed.startsWith("/") ? trimmed : `/${trimmed}`; }
function repoName(repo: string) { return (repo || "").split("/").pop() || ""; }
function deploymentUrl(repo: string, route: string) { const app = repoName(repo); const path = normalizeRoute(route); if (typeof window !== "undefined" && repo === "hawk7227/streamsailive") return `${window.location.origin}${path}`; if (repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${path}`; if (repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${path}`; return app ? `https://${app}.vercel.app${path}` : path; }
function editableProxyUrl(url: string) { return `/api/streams-builder/editable-preview?url=${encodeURIComponent(url)}`; }
function stripOrigin(value?: string) { try { const url = new URL(value || ""); return `${url.pathname}${url.search}${url.hash}`; } catch { return value || ""; } }
function sourceValues(event: EditEvent) { return Array.from(new Set([event.original, event.text, event.src, stripOrigin(event.src), stripOrigin(event.original)].map((value) => String(value || "").trim()).filter(Boolean))); }
function replaceFirst(content: string, from?: string, to?: string) { const original = String(from || "").trim(); const next = String(to || "").trim(); if (!original || !next || original === next || !content.includes(original)) return content; return content.replace(original, next); }
function replaceAny(content: string, event: EditEvent, nextValue: string) { for (const value of sourceValues(event)) { if (content.includes(value)) return content.replace(value, nextValue); } return content; }
function removeAny(content: string, event: EditEvent) { for (const value of sourceValues(event)) { if (content.includes(value)) return content.replace(value, ""); } return content; }
function styleObject(event: EditEvent) { const items: string[] = []; if (event.width) items.push(`width: ${JSON.stringify(`${event.width}px`)}`); if (event.height) items.push(`height: ${JSON.stringify(`${event.height}px`)}`); if (event.transform) items.push(`transform: ${JSON.stringify(event.transform)}`); return items.length ? `{{ ${items.join(", ")} }}` : ""; }
function applyStyleToSource(content: string, event: EditEvent) { const style = styleObject(event); if (!style) return content; const values = sourceValues(event); const lines = content.split("\n"); const index = lines.findIndex((line) => values.some((value) => line.includes(value))); if (index < 0) return content; let target = index; while (target > 0 && !lines[target].includes("<")) target -= 1; if (lines[target].includes("style=")) return content; lines[target] = lines[target].replace(/<([A-Za-z][^\s/>]*)(\s|>)/, `<$1 style=${style}$2`); return lines.join("\n"); }
function applyVisualEvent(content: string, event: EditEvent) { if (event.replacementDataUrl) return replaceAny(content, event, event.replacementDataUrl); if (event.kind === "container" || event.kind === "image") return removeAny(content, event); if (event.transform || event.width || event.height) return applyStyleToSource(content, event); return replaceFirst(content, event.original, event.text); }
function draftKey(repo: string, branch: string, filePath: string) { return `streams-builder:visual-draft:${repo}:${branch}:${filePath}`; }

async function callLinePatches(input: { repo: string; branch: string; filePath: string; content: string; push: boolean; sourceTruthId: string; checkpointId: string }) {
  const response = await fetch("/api/streams-builder/line-patches", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ repository: input.repo, branch: input.branch, filePath: input.filePath, allowLargeReplacement: true, sourceTruthId: input.sourceTruthId, checkpointId: input.checkpointId, push: input.push, commitMessage: `Apply visual editor changes to ${input.filePath}`, operations: [{ id: `visual-editor-${Date.now()}`, type: "replace_full_file", filePath: input.filePath, startLine: 1, endLine: 1, content: input.content, reason: "Visual editor approved draft replacement" }] }) });
  const json = (await response.json().catch(() => ({}))) as LinePatchResult;
  if (!response.ok || json.ok === false) throw new Error(json.error || json.preview?.errors?.join("; ") || "Line patch request failed");
  return json;
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceRoute = normalizeRoute(route);
  const defaultUrl = useMemo(() => deploymentUrl(repo, sourceRoute), [repo, sourceRoute]);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [browserUrl, setBrowserUrl] = useState(defaultUrl);
  const [frameKey, setFrameKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EditEvent | null>(null);
  const [edits, setEdits] = useState<EditEvent[]>([]);
  const [draftContent, setDraftContent] = useState(content || "");
  const [draftId, setDraftId] = useState("");
  const [checkpointId, setCheckpointId] = useState("");
  const [patchState, setPatchState] = useState<PatchState>("not_generated");
  const [commitSha, setCommitSha] = useState("");
  const [saving, setSaving] = useState(false);
  const ready = Boolean(repo && filePath);
  const liveUrl = browserUrl || defaultUrl;
  const editorUrl = editableProxyUrl(liveUrl);
  const sourceTruthId = useMemo(() => `${repo || "repo"}:${branch || "branch"}:${filePath || "file"}:${sourceRoute}`, [repo, branch, filePath, sourceRoute]);

  useEffect(() => { setBrowserUrl(defaultUrl); setSelected(null); setEdits([]); setDraftContent(content || ""); setPatchState("not_generated"); setCommitSha(""); setFrameKey((value) => value + 1); setDrawerOpen(false); onProof(`Visual editor mounted original page through same-origin editable preview: ${repo || "no repo"}@${branch || "no branch"}:${sourceRoute}`); }, [repo, branch, sourceRoute, filePath, defaultUrl]);

  function applyDraft(next: string, proof: string) { setDraftContent(next); onContentChange(next); setPatchState("not_generated"); onProof(proof); }
  function handleVisualEvent(payload: EditEvent, proof: string) { setSelected(payload); setEdits((items) => [...items.slice(-40), payload]); const nextContent = applyVisualEvent(draftContent || "", payload); if (nextContent !== draftContent) applyDraft(nextContent, proof); else { setPatchState("not_generated"); onProof(`${proof} Event tracked, but exact source string was not found in the open file.`); } }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.source !== "streams-editable-preview") return;
      const payload = (data.payload || {}) as EditEvent;
      if (data.type === "streams-editable-select") { setSelected(payload); onChat(`Selected ${payload.kind || "text"} on original page: ${payload.text || payload.src || ""}`); }
      if (data.type === "streams-editable-input") setSelected(payload);
      if (data.type === "streams-editable-commit") handleVisualEvent(payload, `Converted text edit into source draft: ${payload.original || ""} to ${payload.text || ""}`);
      if (data.type === "streams-editable-image-replace") handleVisualEvent(payload, `Converted image replacement into source draft: ${payload.replacementName || payload.src || "image"}`);
      if (data.type === "streams-editable-remove" || data.type === "streams-editable-delete") handleVisualEvent(payload, `Converted remove/delete into source draft for ${payload.kind || "element"}.`);
      if (data.type === "streams-editable-style") handleVisualEvent(payload, `Converted transform/style into source draft for ${payload.kind || "element"}.`);
      if (data.type === "streams-editable-transform-start") { setSelected(payload); setEdits((items) => [...items.slice(-40), payload]); onProof(`Transform mode started for ${payload.kind || "element"}.`); }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [draftContent, onChat, onContentChange, onProof]);

  function switchMode(nextMode: ViewMode) { setViewMode(nextMode); if (nextMode === "advanced") setDrawerOpen(true); setFrameKey((value) => value + 1); onProof(`Visual editor mode: ${nextMode}`); }
  function refreshPreview() { setFrameKey((value) => value + 1); onProof(`Refreshed preview: ${liveUrl}`); }
  function saveDraft() { if (!ready) return; const nextDraftId = draftId || `draft-${Date.now()}`; const nextCheckpointId = `checkpoint-${Date.now()}`; const payload = { id: nextDraftId, checkpointId: nextCheckpointId, repo, branch, filePath, route: sourceRoute, sourceTruthId, baseContent: content || "", currentContent: draftContent || "", edits, patchState: "not_generated", updatedAt: new Date().toISOString() }; window.localStorage.setItem(draftKey(repo, branch, filePath), JSON.stringify(payload)); setDraftId(nextDraftId); setCheckpointId(nextCheckpointId); setPatchState("not_generated"); onProof(`Draft saved in Streams library: ${nextDraftId}`); }
  async function generatePatch() { if (!ready) return; setSaving(true); try { const activeCheckpoint = checkpointId || `checkpoint-${Date.now()}`; if (!checkpointId) setCheckpointId(activeCheckpoint); const result = await callLinePatches({ repo, branch, filePath, content: draftContent || content || "", push: false, sourceTruthId, checkpointId: activeCheckpoint }); setPatchState("generated"); onProof(`Patch generated, not pushed. Changed lines: ${result.preview?.changedLineCount ?? "unknown"}`); } catch (error) { setPatchState("failed"); onProof(`Patch generation failed: ${error instanceof Error ? error.message : "unknown error"}`); } finally { setSaving(false); } }
  async function pushToGitHub() { if (!ready || patchState !== "generated") return; setSaving(true); try { const activeCheckpoint = checkpointId || `checkpoint-${Date.now()}`; const result = await callLinePatches({ repo, branch, filePath, content: draftContent || content || "", push: true, sourceTruthId, checkpointId: activeCheckpoint }); const sha = result.pushResult?.commit?.sha || ""; setCommitSha(sha); setPatchState("pushed"); onProof(`Pushed visual editor draft to GitHub${sha ? `: ${sha}` : "."}`); setFrameKey((value) => value + 1); } catch (error) { setPatchState("failed"); onProof(`GitHub push failed: ${error instanceof Error ? error.message : "unknown error"}`); } finally { setSaving(false); } }
  function resetEditor() { setBrowserUrl(defaultUrl); setSelected(null); setEdits([]); setDraftContent(content || ""); setPatchState("not_generated"); setCommitSha(""); setFrameKey((value) => value + 1); setDrawerOpen(false); onProof("Reset visual editor to original page source truth."); }

  return (
    <section className="visualEditor">
      <header className="top"><div><b>VISUAL EDITOR</b><span>{stationLabel} · Save Draft first, Generate Patch, then Push to GitHub after review</span></div><div className="routeBar"><button type="button" onClick={refreshPreview}>↻</button><input value={liveUrl} onChange={(event) => setBrowserUrl(event.target.value)} /><button type="button" onClick={refreshPreview}>Open</button></div></header>
      <main className={`canvas ${viewMode}`}><section className={viewMode === "mobile" ? "phoneFrame" : "desktopFrame"}>{ready ? <iframe key={`${frameKey}-${viewMode}-${liveUrl}`} title="Editable original frontend preview" src={viewMode === "editor" || viewMode === "advanced" ? editorUrl : liveUrl} /> : <div className="emptyFrame"><h2>Pull a source file first</h2><p>The actual frontend will appear here.</p></div>}</section></main>
      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Selected</span><b>{selected?.text || selected?.src || "Click text/image/panel"}</b></div><div><span>File</span><b>{filePath || "no file"}</b></div><div><span>Patch</span><b>{patchState}{commitSha ? ` · ${commitSha.slice(0, 7)}` : ""}</b></div><div><span>Mode</span><b>{viewMode}</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" onClick={saveDraft} disabled={!ready || saving}>Save Draft</button><button type="button" onClick={generatePatch} disabled={!ready || saving}>Generate Patch</button><button type="button" onClick={pushToGitHub} disabled={!ready || saving || patchState !== "generated"}>Push GitHub</button><button type="button" onClick={resetEditor}>Reset</button></footer>
      <details className="editorDrawer" open={drawerOpen || viewMode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}><summary>Advanced edit log / source controls</summary><section className="drawerGrid"><section className="patchBox"><b>Selected</b><p>kind: {selected?.kind || "none"}</p><p>selector: {selected?.selector || "none"}</p><p>original: {selected?.original || "none"}</p><p>current: {selected?.text || selected?.src || "none"}</p><p>style: {selected?.inlineStyle || "none"}</p><p>file: {filePath || "none"}</p></section><section className="patchBox"><b>Recent edits</b>{edits.length ? edits.slice(-8).map((edit, index) => <p key={`${edit.id}-${index}`}>{edit.kind || "text"}: {edit.original || edit.src || "item"} → {edit.text || edit.replacementName || edit.inlineStyle || "changed"}</p>) : <p>No edits yet.</p>}</section></section></details>
      <style jsx>{`.visualEditor{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#020617;color:#fff;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(148,163,184,.18);background:#0f172a}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.routeBar{display:grid;grid-template-columns:40px minmax(260px,1fr) 80px;gap:8px;width:min(680px,56vw)}.routeBar input{height:38px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#fff;padding:0 14px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}button:disabled{opacity:.48;cursor:not-allowed}.canvas{position:relative;min-height:0;overflow:hidden;background:#020617}.desktopFrame{position:relative;height:calc(100% - 18px);margin:10px;border:1px solid rgba(124,58,237,.5);border-radius:16px;overflow:auto;background:#fff}.phoneFrame{position:relative;width:430px;height:min(760px,calc(100% - 30px));margin:12px auto;border:12px solid #111827;border-radius:36px;overflow:auto;background:#fff}.desktopFrame iframe,.phoneFrame iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.emptyFrame{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(7,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:260px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.patchBox{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}`}</style>
    </section>
  );
}
