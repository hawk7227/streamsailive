"use client";

import { useEffect, useMemo, useState } from "react";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

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

type ViewMode = "editor" | "browser" | "mobile" | "advanced" | "code" | "split";
type PatchState = "not_generated" | "generated" | "approved" | "pushed" | "failed";
type PreviewBuildState = "not_started" | "queued" | "building" | "succeeded" | "failed";
type ReviewDevice = "desktop" | "iphone-14-pro-max";
type ReviewBrowser = "safari" | "chrome";

type EditEvent = {
  id?: string;
  kind?: string;
  selector?: string;
  original?: string;
  text?: string;
  src?: string;
  replacementDataUrl?: string;
  replacementName?: string;
  inlineStyle?: string;
  width?: number;
  height?: number;
  transform?: string;
};

type PreviewBuildResult = {
  previewId?: string;
  status?: PreviewBuildState;
  previewUrl?: string;
  previewBranch?: string;
  deploymentId?: string;
  deploymentUrl?: string;
  error?: string;
  logs?: string[];
};

type LinePatchResult = {
  ok?: boolean;
  pushed?: boolean;
  error?: string;
  preview?: { ok?: boolean; changedLineCount?: number; nextContent?: string; errors?: string[]; audit?: string[] };
  previewBuild?: PreviewBuildResult | null;
  pushResult?: { commit?: { sha?: string } };
};

type CodeSelection = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
};

function normalizeRoute(value: string) {
  const trimmed = (value || "/").trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function repoName(repo: string) {
  return (repo || "").split("/").pop() || "";
}

function deploymentUrl(repo: string, route: string) {
  const app = repoName(repo);
  const path = normalizeRoute(route);
  if (typeof window !== "undefined" && repo === "hawk7227/streamsailive") return `${window.location.origin}${path}`;
  if (repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${path}`;
  if (repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${path}`;
  return app ? `https://${app}.vercel.app${path}` : path;
}

function editableProxyUrl(url: string) {
  return `/api/streams-builder/editable-preview?url=${encodeURIComponent(url)}`;
}

function reviewProxyUrl(url: string) {
  return `/api/streams-builder/editable-preview?review=1&url=${encodeURIComponent(url)}`;
}

function draftKey(repo: string, branch: string, filePath: string) {
  return `streams-builder:visual-draft:${repo}:${branch}:${filePath}`;
}

function sourceValues(event: EditEvent) {
  return [event.original, event.text, event.src].map((value) => String(value || "").trim()).filter(Boolean);
}

function replaceFirstKnownValue(source: string, event: EditEvent, replacement: string) {
  for (const value of sourceValues(event)) {
    if (value && source.includes(value)) return source.replace(value, replacement);
  }
  return source;
}

function applyVisualEvent(source: string, event: EditEvent) {
  if (event.replacementDataUrl) return replaceFirstKnownValue(source, event, event.replacementDataUrl);
  if (event.kind === "image") return replaceFirstKnownValue(source, event, "");
  return replaceFirstKnownValue(source, event, event.text || "");
}

async function callLinePatches(input: {
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  push: boolean;
  sourceTruthId: string;
  checkpointId: string;
  buildPreview?: boolean;
  route?: string;
}) {
  const response = await fetch("/api/streams-builder/line-patches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      repository: input.repo,
      branch: input.branch,
      filePath: input.filePath,
      allowLargeReplacement: true,
      sourceTruthId: input.sourceTruthId,
      checkpointId: input.checkpointId,
      push: input.push,
      buildPreview: Boolean(input.buildPreview),
      route: input.route || "/",
      commitMessage: `Apply visual editor changes to ${input.filePath}`,
      operations: [
        {
          id: `visual-editor-${Date.now()}`,
          type: "replace_full_file",
          filePath: input.filePath,
          startLine: 1,
          endLine: 1,
          content: input.content,
          reason: "Visual editor approved draft replacement",
        },
      ],
    }),
  });
  const json = (await response.json().catch(() => ({}))) as LinePatchResult;
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || json.preview?.errors?.join("; ") || json.previewBuild?.error || "Line patch request failed");
  }
  return json;
}

async function pollPreviewBuild(previewId: string) {
  const response = await fetch(`/api/streams-builder/preview-build?previewId=${encodeURIComponent(previewId)}`, { cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; previewBuild?: PreviewBuildResult };
  if (!response.ok || json.ok === false) throw new Error(json.error || "Temporary preview poll failed");
  return json.previewBuild || null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function VisualEditingWorkstation({ stationLabel, route, filePath, repo, branch, content, onContentChange, onProof, onChat }: Props) {
  const sourceRoute = normalizeRoute(route);
  const defaultUrl = useMemo(() => deploymentUrl(repo, sourceRoute), [repo, sourceRoute]);
  const sourceTruthId = useMemo(() => `${repo || "repo"}:${branch || "branch"}:${filePath || "file"}:${sourceRoute}`, [repo, branch, filePath, sourceRoute]);

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
  const [previewBuildState, setPreviewBuildState] = useState<PreviewBuildState>("not_started");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [previewLogs, setPreviewLogs] = useState<string[]>([]);
  const [reviewDevice, setReviewDevice] = useState<ReviewDevice>("desktop");
  const [reviewBrowser, setReviewBrowser] = useState<ReviewBrowser>("chrome");
  const [reviewFullscreen, setReviewFullscreen] = useState(false);
  const [reviewSafeZone, setReviewSafeZone] = useState(false);
  const [commitSha, setCommitSha] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeSelection, setCodeSelection] = useState<CodeSelection | null>(null);
  const [lastError, setLastError] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");

  const ready = Boolean(repo && branch && filePath);
  const liveUrl = browserUrl || defaultUrl;
  const editorUrl = editableProxyUrl(liveUrl);
  const pushReady = ready && !saving && patchState === "generated" && generatedContent === draftContent && previewBuildState === "succeeded" && Boolean(previewUrl) && !lastError;

  function chatEvent(phase: string, message: string) {
    onChat(message);
    const detail = { phase, message, repo, branch, filePath, route: sourceRoute, patchState, previewBuildState, previewUrl, previewId };
    window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail }));
    window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail }));
  }

  function sendCodeFind(payload: EditEvent) {
    const query = sourceValues(payload).find((value) => value.length > 2 && value.length < 240) || "";
    if (query) window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: { action: "search", query } }));
  }

  function applyPreviewBuild(build: PreviewBuildResult | null) {
    if (!build) return;
    if (build.previewId) setPreviewId(build.previewId);
    if (build.status) setPreviewBuildState(build.status);
    if (build.previewUrl) setPreviewUrl(build.previewUrl);
    if (build.error) setLastError(build.error);
    if (build.logs) setPreviewLogs(build.logs);
  }

  useEffect(() => {
    setBrowserUrl(defaultUrl);
    setSelected(null);
    setEdits([]);
    setDraftContent(content || "");
    setPatchState("not_generated");
    setPreviewBuildState("not_started");
    setPreviewUrl("");
    setPreviewId("");
    setPreviewLogs([]);
    setCommitSha("");
    setLastError("");
    setGeneratedContent("");
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: { repo, branch, path: filePath, route: sourceRoute, content } }));
    onProof(`Visual editor mounted editable preview: ${repo || "no repo"}@${branch || "no branch"}:${sourceRoute}`);
    chatEvent("file-pulled", `Pulled ${filePath || "source file"}. Visual editor, code editor, preview build, and GitHub push status are tracked.`);
  }, [repo, branch, sourceRoute, filePath, defaultUrl]);

  function applyDraft(next: string, proof: string) {
    setDraftContent(next);
    onContentChange(next);
    setPatchState("not_generated");
    setPreviewBuildState("not_started");
    setPreviewUrl("");
    setPreviewId("");
    setPreviewLogs([]);
    setLastError("");
    setGeneratedContent("");
    window.dispatchEvent(new CustomEvent("streams-builder:code-draft-changed", { detail: { repo, branch, path: filePath, route: sourceRoute, content: next, draftDirty: true, saved: false, patchState: "not_generated" } }));
    onProof(proof);
  }

  function handleCodeChange(next: string) {
    applyDraft(next, "Code editor draft updated from shared visual editor code panel.");
    chatEvent("manual-code-edit", `Manual code change made in ${filePath}. Save Draft must regenerate the patch and real temporary preview before push.`);
  }

  function handleVisualEvent(payload: EditEvent, proof: string) {
    setSelected(payload);
    setEdits((items) => [...items.slice(-40), payload]);
    sendCodeFind(payload);
    const nextContent = applyVisualEvent(draftContent || "", payload);
    if (nextContent !== draftContent) {
      applyDraft(nextContent, proof);
      chatEvent("visual-edit", `Visual ${payload.kind || "element"} change updated the draft. Save Draft must regenerate the patch and real temporary preview before push.`);
    } else {
      setPatchState("not_generated");
      onProof(`${proof} Event tracked, but exact source value was not found in the open file.`);
      chatEvent("visual-edit-unmatched", `Visual change was tracked, but exact source value was not found in ${filePath}. Use code search to confirm the JSX block.`);
    }
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.source !== "streams-editable-preview") return;
      const payload = (data.payload || {}) as EditEvent;
      if (data.type === "streams-editable-select") {
        setSelected(payload);
        sendCodeFind(payload);
        onChat(`Selected ${payload.kind || "text"}: ${payload.text || payload.src || ""}`);
      }
      if (data.type === "streams-editable-input") {
        setSelected(payload);
        chatEvent("visual-input", `User is typing in visual editor: ${payload.text || payload.original || "text"}`);
      }
      if (data.type === "streams-editable-commit") handleVisualEvent(payload, `Converted text edit into source draft: ${payload.original || ""} to ${payload.text || ""}`);
      if (data.type === "streams-editable-image-replace") handleVisualEvent(payload, `Converted image replacement into source draft: ${payload.replacementName || payload.src || "image"}`);
      if (data.type === "streams-editable-remove" || data.type === "streams-editable-delete") handleVisualEvent(payload, `Converted remove/delete into source draft for ${payload.kind || "element"}.`);
      if (data.type === "streams-editable-style") handleVisualEvent(payload, `Converted transform/style into source draft for ${payload.kind || "element"}.`);
      if (data.type === "streams-editable-transform-start") {
        setSelected(payload);
        setEdits((items) => [...items.slice(-40), payload]);
        sendCodeFind(payload);
        onProof(`Transform mode started for ${payload.kind || "element"}.`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [draftContent, onChat, onContentChange, onProof]);

  function switchMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    if (nextMode === "advanced") setDrawerOpen(true);
    setFrameKey((value) => value + 1);
    onProof(`Visual editor mode: ${nextMode}`);
  }

  function refreshPreview() {
    setFrameKey((value) => value + 1);
    onProof(`Refreshed preview: ${viewMode === "browser" && previewUrl ? previewUrl : liveUrl}`);
  }

  function updateReviewMode(next: Partial<{ device: ReviewDevice; browser: ReviewBrowser; fullscreen: boolean; safeZone: boolean }>) {
    if (next.device) {
      setReviewDevice(next.device);
      chatEvent(next.device === "iphone-14-pro-max" ? "review-mode-iphone-14-pro-max" : "review-mode-desktop", `Browser Review switched to ${next.device}.`);
    }
    if (next.browser) {
      setReviewBrowser(next.browser);
      chatEvent(next.browser === "safari" ? "review-mode-safari" : "review-mode-chrome", `Browser Review switched to ${next.browser} frame.`);
    }
    if (typeof next.fullscreen === "boolean") {
      setReviewFullscreen(next.fullscreen);
      chatEvent("review-mode-fullscreen", `${next.fullscreen ? "Opened" : "Closed"} Browser Review full screen mode.`);
    }
    if (typeof next.safeZone === "boolean") {
      setReviewSafeZone(next.safeZone);
      chatEvent("review-mode-safe-zone", `${next.safeZone ? "Enabled" : "Disabled"} Browser Review safe-zone overlay.`);
    }
  }

  async function waitForPreview(initialBuild: PreviewBuildResult | null | undefined): Promise<PreviewBuildResult> {
    applyPreviewBuild(initialBuild || null);
    const activePreviewId = initialBuild?.previewId;
    if (!activePreviewId) throw new Error(initialBuild?.error || "Temporary preview build did not return a previewId.");
    chatEvent("preview-build-started", `Real temporary preview build started on branch ${initialBuild?.previewBranch || "unknown"}.`);

    let current: PreviewBuildResult | null = initialBuild;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      if (current?.status === "succeeded" && current.previewUrl) {
        applyPreviewBuild(current);
        chatEvent("preview-build-succeeded", `Real temporary preview succeeded: ${current.previewUrl}`);
        return current;
      }
      if (current?.status === "failed") throw new Error(current.error || "Temporary preview build failed.");
      await wait(attempt < 6 ? 3500 : 6000);
      current = await pollPreviewBuild(activePreviewId);
      applyPreviewBuild(current);
      chatEvent("preview-build-poll", `Temporary preview status: ${current?.status || "unknown"}.`);
    }
    throw new Error("Temporary preview build is still building. Browser Review is not ready yet; poll again before push.");
  }

  async function saveDraft() {
    if (!ready) {
      const message = "Save Draft failed: repo, branch, or file path is missing.";
      setLastError(message);
      setPatchState("failed");
      chatEvent("patch-generation-failed", `${message} Recommendation: pull a valid source file and try again.`);
      return;
    }
    setSaving(true);
    setLastError("");
    const nextDraftId = draftId || `draft-${Date.now()}`;
    const nextCheckpointId = checkpointId || `checkpoint-${Date.now()}`;
    const nextContent = draftContent || content || "";
    try {
      const payload = { id: nextDraftId, checkpointId: nextCheckpointId, repo, branch, filePath, route: sourceRoute, sourceTruthId, baseContent: content || "", currentContent: nextContent, edits, patchState: "not_generated", updatedAt: new Date().toISOString() };
      window.localStorage.setItem(draftKey(repo, branch, filePath), JSON.stringify(payload));
      setDraftId(nextDraftId);
      setCheckpointId(nextCheckpointId);
      chatEvent("draft-saved", `Draft saved for ${filePath}. Generating patch and real temporary preview now.`);
      const result = await callLinePatches({ repo, branch, filePath, content: nextContent, push: false, sourceTruthId, checkpointId: nextCheckpointId, buildPreview: true, route: sourceRoute });
      setGeneratedContent(nextContent);
      setPatchState("generated");
      const build = await waitForPreview(result.previewBuild);
      setViewMode("browser");
      setFrameKey((value) => value + 1);
      onProof(`Draft saved, patch generated, and real temporary Browser Review opened. Changed lines: ${result.preview?.changedLineCount ?? "unknown"}. Preview: ${build.previewUrl}`);
      chatEvent("browser-review-opened", `Browser Review opened using real temporary preview URL ${build.previewUrl}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setLastError(message);
      setPatchState("failed");
      setPreviewBuildState("failed");
      setViewMode("editor");
      onProof(`Save Draft / patch / real preview generation failed: ${message}`);
      chatEvent("patch-generation-failed", `Save Draft failed while generating patch or real temporary preview: ${message}.`);
    } finally {
      setSaving(false);
    }
  }

  async function generatePatch() {
    await saveDraft();
  }

  async function pushToGitHub() {
    if (!pushReady) {
      const reason = !ready ? "repo, branch, or file path is missing" : patchState !== "generated" ? "patch is not generated" : generatedContent !== draftContent ? "draft changed after save" : previewBuildState !== "succeeded" || !previewUrl ? "real temporary preview is missing or failed" : lastError || "requirements are not met";
      setLastError(reason);
      chatEvent(reason.includes("preview") ? "push-blocked-preview-missing" : "push-blocked", `Push GitHub is blocked: ${reason}.`);
      return;
    }
    setSaving(true);
    try {
      const activeCheckpoint = checkpointId || `checkpoint-${Date.now()}`;
      const result = await callLinePatches({ repo, branch, filePath, content: draftContent || content || "", push: true, sourceTruthId, checkpointId: activeCheckpoint });
      const sha = result.pushResult?.commit?.sha || "";
      setCommitSha(sha);
      setPatchState("pushed");
      onProof(`Pushed reviewed visual editor draft to GitHub${sha ? `: ${sha}` : "."}`);
      chatEvent("github-pushed", `Changes pushed to GitHub successfully${sha ? ` with commit ${sha.slice(0, 7)}` : ""}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setPatchState("failed");
      setLastError(message);
      onProof(`GitHub push failed: ${message}`);
      chatEvent("github-push-failed", `GitHub push failed: ${message}.`);
    } finally {
      setSaving(false);
    }
  }

  function resetEditor() {
    setBrowserUrl(defaultUrl);
    setSelected(null);
    setEdits([]);
    setDraftContent(content || "");
    setPatchState("not_generated");
    setPreviewBuildState("not_started");
    setPreviewUrl("");
    setPreviewId("");
    setPreviewLogs([]);
    setCommitSha("");
    setLastError("");
    setGeneratedContent("");
    setFrameKey((value) => value + 1);
    setDrawerOpen(false);
    onProof("Reset visual editor to original page source truth.");
  }

  function reviewPanel() {
    return (
      <aside className="reviewPanel">
        <b>Browser Review</b>
        <span>{pushReady ? "Ready to Push" : "Push Blocked"}</span>
        <p>{patchState === "generated" && previewBuildState === "succeeded" ? `Real temporary preview ready: ${previewId}. Click through before pushing.` : patchState === "failed" || previewBuildState === "failed" ? `Issue: ${lastError || "Patch/preview failed."}` : previewBuildState === "building" || previewBuildState === "queued" ? "Building real temporary preview..." : "Save Draft first to generate the review patch and real temporary preview."}</p>
        {lastError ? <p className="errorText">{lastError}</p> : null}
        <button type="button" className={pushReady ? "pushReady" : "pushBlocked"} onClick={pushToGitHub} disabled={!pushReady}>{pushReady ? "Push GitHub" : "Push GitHub Locked"}</button>
      </aside>
    );
  }

  function reviewControls() {
    if (viewMode !== "browser" && viewMode !== "split") return null;
    return (
      <section className="reviewControls">
        <button type="button" className={reviewDevice === "desktop" ? "active" : ""} onClick={() => updateReviewMode({ device: "desktop" })}>Desktop</button>
        <button type="button" className={reviewDevice === "iphone-14-pro-max" ? "active" : ""} onClick={() => updateReviewMode({ device: "iphone-14-pro-max" })}>iPhone 14 Pro Max</button>
        <button type="button" className={reviewBrowser === "safari" ? "active" : ""} onClick={() => updateReviewMode({ browser: "safari" })}>Safari</button>
        <button type="button" className={reviewBrowser === "chrome" ? "active" : ""} onClick={() => updateReviewMode({ browser: "chrome" })}>Chrome</button>
        <button type="button" className={reviewFullscreen ? "active" : ""} onClick={() => updateReviewMode({ fullscreen: !reviewFullscreen })}>Full Screen</button>
        <button type="button" className={reviewSafeZone ? "active" : ""} onClick={() => updateReviewMode({ safeZone: !reviewSafeZone })}>Safe Zone</button>
      </section>
    );
  }

  function previewFrame(className = viewMode === "mobile" || reviewDevice === "iphone-14-pro-max" ? "phoneFrame" : "desktopFrame") {
    const src = viewMode === "browser" && previewUrl ? reviewProxyUrl(previewUrl) : viewMode === "editor" || viewMode === "advanced" ? editorUrl : liveUrl;
    const frameClass = viewMode === "browser" ? `${className} reviewFrame ${reviewBrowser} ${reviewFullscreen ? "fullScreen" : ""} ${reviewSafeZone ? "safeZone" : ""}` : className;
    return <section className={frameClass}>{ready ? <iframe key={`${frameKey}-${viewMode}-${src}-${reviewDevice}-${reviewBrowser}-${reviewFullscreen}-${reviewSafeZone}`} title="Visual editor preview" src={src} /> : <div className="emptyFrame"><h2>Pull a source file first</h2><p>The actual frontend will appear here.</p></div>}</section>;
  }

  function codePanel() {
    return (
      <section className="codePanel">
        <div className="codeActions"><button type="button" onClick={saveDraft} disabled={!ready || saving}>Save Draft</button><button type="button" onClick={generatePatch} disabled={!ready || saving}>Generate Patch</button></div>
        <RuntimeCodeEditor value={draftContent || ""} filePath={filePath || "no-file-selected"} sha={commitSha || undefined} onChange={handleCodeChange} onSelectionChange={setCodeSelection} />
      </section>
    );
  }

  function mainCanvas() {
    if (viewMode === "code") return <main className="canvas codeMode">{codePanel()}</main>;
    if (viewMode === "split") return <main className="canvas splitMode">{codePanel()}<section className="splitPreview"><div className="paneTitle"><b>Real Temporary Browser Review</b><span>{previewUrl || "Save Draft to create real temporary preview"}</span></div>{reviewControls()}{previewFrame(reviewDevice === "iphone-14-pro-max" ? "phoneFrame embedded" : "desktopFrame embedded")}{reviewPanel()}</section></main>;
    return <main className={`canvas ${viewMode}`}>{reviewControls()}{previewFrame()}{viewMode === "browser" ? reviewPanel() : null}</main>;
  }

  return (
    <section className="visualEditor">
      <header className="top"><div><b>VISUAL EDITOR</b><span>{stationLabel} · editor stays original; Browser Review uses real temporary preview</span></div><div className="routeBar"><button type="button" onClick={refreshPreview}>↻</button><input value={viewMode === "browser" && previewUrl ? previewUrl : liveUrl} onChange={(event) => setBrowserUrl(event.target.value)} /><button type="button" onClick={refreshPreview}>Open</button></div></header>
      {mainCanvas()}
      <footer className="sourceActionStrip"><div><span>Route</span><b>{sourceRoute}</b></div><div><span>Selected</span><b>{selected?.text || selected?.src || (codeSelection ? `Lines ${codeSelection.startLine}-${codeSelection.endLine}` : "Click text/image/panel")}</b></div><div><span>File</span><b>{filePath || "no file"}</b></div><div><span>Patch</span><b>{patchState}{commitSha ? ` · ${commitSha.slice(0, 7)}` : ""}</b></div><div><span>Preview</span><b>{previewBuildState}{previewId ? ` · ${previewId}` : ""}</b></div><button type="button" className={viewMode === "editor" ? "active" : ""} onClick={() => switchMode("editor")}>Editor</button><button type="button" className={viewMode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Browser</button><button type="button" className={viewMode === "mobile" ? "active" : ""} onClick={() => switchMode("mobile")}>Mobile</button><button type="button" className={viewMode === "split" ? "active" : ""} onClick={() => switchMode("split")}>Code Editor</button><button type="button" onClick={saveDraft} disabled={!ready || saving}>{saving ? "Saving..." : "Save Draft"}</button><button type="button" onClick={generatePatch} disabled={!ready || saving}>Generate Patch</button><button type="button" onClick={resetEditor}>Reset</button></footer>
      <details className="editorDrawer" open={drawerOpen || viewMode === "advanced"} onToggle={(event) => setDrawerOpen(event.currentTarget.open)}><summary>Advanced edit log / source controls</summary><section className="drawerGrid"><section className="patchBox"><b>Selected</b><p>kind: {selected?.kind || "none"}</p><p>selector: {selected?.selector || "none"}</p><p>file: {filePath || "none"}</p><p>preview: {previewUrl || "none"}</p><p>error: {lastError || "none"}</p></section><section className="patchBox"><b>Preview logs</b>{previewLogs.length ? previewLogs.slice(-8).map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>No preview logs yet.</p>}</section></section></details>
      <style jsx>{`.visualEditor{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#020617;color:#fff;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(148,163,184,.18);background:#0f172a}.top b{display:block;font-size:13px}.top span{display:block;color:#93c5fd;font-size:11px}.routeBar{display:grid;grid-template-columns:40px minmax(260px,1fr) 80px;gap:8px;width:min(680px,56vw)}.routeBar input{height:38px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#fff;padding:0 14px}button{border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#7c3aed;color:#fff;height:36px;padding:0 12px;font-size:11px;font-weight:900;cursor:pointer}button.active{background:#065f46;color:#6ee7b7;border-color:#34d399}button:disabled{opacity:.48;cursor:not-allowed}.canvas{position:relative;min-height:0;overflow:hidden;background:#020617}.desktopFrame{position:relative;height:calc(100% - 18px);margin:10px;border:1px solid rgba(124,58,237,.5);border-radius:16px;overflow:auto;background:#fff}.phoneFrame{position:relative;width:430px;height:min(932px,calc(100% - 30px));margin:12px auto;border:12px solid #111827;border-radius:38px;overflow:auto;background:#fff}.reviewFrame.safari:before,.reviewFrame.chrome:before{position:sticky;top:0;z-index:4;display:block;height:34px;background:#f8fafc;color:#0f172a;border-bottom:1px solid #cbd5e1;padding:8px 12px;font-size:12px;font-weight:900}.reviewFrame.safari:before{content:'Safari · Real Temporary Preview'}.reviewFrame.chrome:before{content:'Chrome · Real Temporary Preview'}.reviewFrame.safeZone:after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,rgba(34,197,94,.18) 0 48px,transparent 48px calc(100% - 34px),rgba(34,197,94,.18) calc(100% - 34px));outline:2px dashed rgba(34,197,94,.6);outline-offset:-14px}.reviewFrame.fullScreen{position:absolute!important;inset:8px!important;width:auto!important;height:auto!important;margin:0!important;z-index:35}.desktopFrame iframe,.phoneFrame iframe{display:block;width:100%;height:1800px;min-height:100%;border:0;background:#fff}.emptyFrame{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.codeMode{padding:10px}.codePanel{position:relative;min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;overflow:hidden}.codeActions,.reviewControls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.reviewControls{position:relative;z-index:28;padding:8px 10px;background:rgba(2,6,23,.92);border-bottom:1px solid rgba(148,163,184,.16)}.splitMode{display:grid;grid-template-columns:minmax(520px,.95fr) minmax(520px,1fr);gap:10px;padding:10px}.splitPreview{position:relative;min-width:0;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(124,58,237,.45);border-radius:14px;background:#020617}.paneTitle{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.18);background:#020617;color:#fff;font-size:11px}.paneTitle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93c5fd}.desktopFrame.embedded{height:100%;margin:0;border:0;border-radius:0}.phoneFrame.embedded{height:100%;max-height:932px}.reviewPanel{position:absolute;right:18px;top:62px;z-index:25;width:min(330px,calc(100% - 36px));border:1px solid rgba(34,197,94,.36);border-radius:16px;background:rgba(2,6,23,.94);box-shadow:0 18px 44px rgba(0,0,0,.35);padding:12px;color:#d1fae5}.reviewPanel b{display:block;color:#fff;font-size:13px}.reviewPanel span{display:inline-flex;margin-top:4px;color:#6ee7b7;font-size:11px;font-weight:900;text-transform:uppercase}.reviewPanel p{margin:8px 0 0;color:#cbd5e1;font-size:12px;line-height:1.35}.reviewPanel .errorText{color:#fecaca}.reviewPanel button{width:100%;margin-top:10px}.reviewPanel button.pushReady{background:#16a34a;border-color:#86efac;color:#fff}.reviewPanel button.pushBlocked{background:#334155;border-color:#64748b;color:#cbd5e1}.sourceActionStrip{display:grid;grid-template-columns:repeat(5,minmax(96px,1fr)) repeat(7,auto);gap:8px;align-items:center;padding:8px;background:#020617;border-top:1px solid rgba(148,163,184,.18)}.sourceActionStrip div{min-width:0;border:1px solid rgba(20,184,166,.3);border-radius:12px;background:rgba(8,47,73,.34);padding:8px}.sourceActionStrip span{display:block;color:#6ee7b7;font-size:10px;text-transform:uppercase;font-weight:900}.sourceActionStrip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}.editorDrawer{max-height:260px;overflow:auto;border-top:1px solid rgba(148,163,184,.18);background:#020617}.editorDrawer summary{cursor:pointer;padding:8px 12px;font-size:12px;font-weight:900}.drawerGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.patchBox{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.9);padding:10px;color:#cbd5e1;font-size:11px}.patchBox p{margin:4px 0;color:#94a3b8;font-size:11px;overflow-wrap:anywhere}@media(max-width:1180px){.splitMode{grid-template-columns:minmax(0,1fr)}.codePanel,.splitPreview{min-height:520px}.sourceActionStrip{grid-template-columns:repeat(2,minmax(0,1fr));}.routeBar{width:min(620px,52vw)}}`}</style>
    </section>
  );
}
