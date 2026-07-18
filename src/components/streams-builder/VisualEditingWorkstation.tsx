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
  const [previewBranch, setPreviewBranch] = useState("");
  const [deploymentId, setDeploymentId] = useState("");
  const [deploymentUrlValue, setDeploymentUrlValue] = useState("");
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

  function chatEvent(phase: string, message: string, extra: Record<string, unknown> = {}) {
    onChat(message);
    const detail = { phase, message, repo, branch, filePath, route: sourceRoute, patchState, previewBuildState, previewUrl, previewId, previewBranch, deploymentId, deploymentUrl: deploymentUrlValue, checkpointId, commitSha, ...extra };
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
    if (build.previewBranch) setPreviewBranch(build.previewBranch);
    if (build.deploymentId) setDeploymentId(build.deploymentId);
    if (build.deploymentUrl) setDeploymentUrlValue(build.deploymentUrl);
    if (build.error) setLastError(build.error);
    if (build.logs) setPreviewLogs(build.logs);
    window.dispatchEvent(new CustomEvent("streams-builder:preview-state", {
      detail: {
        repo,
        branch,
        path: filePath,
        route: sourceRoute,
        checkpointId,
        patchState,
        previewBuildState: build.status || previewBuildState,
        previewId: build.previewId || previewId,
        previewUrl: build.previewUrl || previewUrl,
        previewBranch: build.previewBranch || previewBranch,
        deploymentId: build.deploymentId || deploymentId,
        deploymentUrl: build.deploymentUrl || deploymentUrlValue,
        error: build.error || "",
      },
    }));
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
    setPreviewBranch("");
    setDeploymentId("");
    setDeploymentUrlValue("");
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
    setPreviewBranch("");
    setDeploymentId("");
    setDeploymentUrlValue("");
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
    chatEvent("preview-build-started", `Real temporary preview build started on branch ${initialBuild?.previewBranch || "unknown"}.`, initialBuild || {});

    let current: PreviewBuildResult | null = initialBuild;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      if (current?.status === "succeeded" && current.previewUrl) {
        applyPreviewBuild(current);
        chatEvent("preview-build-succeeded", `Real temporary preview succeeded: ${current.previewUrl}`, current);
        return current;
      }
      if (current?.status === "failed") throw new Error(current.error || "Temporary preview build failed.");
      await wait(attempt < 6 ? 3500 : 6000);
      current = await pollPreviewBuild(activePreviewId);
      applyPreviewBuild(current);
      chatEvent("preview-build-poll", `Temporary preview status: ${current?.status || "unknown"}.`, current || {});
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
      chatEvent("draft-saved", `Draft saved for ${filePath}. Generating patch and real temporary preview now.`, { checkpointId: nextCheckpointId });
      const result = await callLinePatches({ repo, branch, filePath, content: nextContent, push: false, sourceTruthId, checkpointId: nextCheckpointId, buildPreview: true, route: sourceRoute });
      setGeneratedContent(nextContent);
      setPatchState("generated");
      const build = await waitForPreview(result.previewBuild);
      window.dispatchEvent(new CustomEvent("streams-builder:code-draft-changed", { detail: { repo, branch, path: filePath, route: sourceRoute, content: nextContent, draftId: nextDraftId, checkpointId: nextCheckpointId, saved: true, patchState: "generated", previewBuildState: build.status || "succeeded", previewId: build.previewId || "", previewUrl: build.previewUrl || "", previewBranch: build.previewBranch || "", deploymentId: build.deploymentId || "", deploymentUrl: build.deploymentUrl || "" } }));
      setViewMode("browser");
      setFrameKey((value) => value + 1);
      onProof(`Draft saved, patch generated, and real temporary Browser Review opened. Changed lines: ${result.preview?.changedLineCount ?? "unknown"}. Preview: ${build.previewUrl}`);
      chatEvent("browser-review-opened", `Browser Review opened using real temporary preview URL ${build.previewUrl}.`, { ...build, checkpointId: nextCheckpointId, patchState: "generated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setLastError(message);
      setPatchState("failed");
      setPreviewBuildState("failed");
      setViewMode("editor");
      onProof(`Save Draft / patch / real preview generation failed: ${message}`);
      chatEvent("patch-generation-failed", `Save Draft failed while generating patch or real temporary preview: ${message}.`, { error: message });
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
      chatEvent("github-pushed", `Changes pushed to GitHub successfully${sha ? ` with commit ${sha.slice(0, 7)}` : ""}.`, { commitSha: sha, checkpointId: activeCheckpoint });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setPatchState("failed");
      setLastError(message);
      onProof(`GitHub push failed: ${message}`);
      chatEvent("github-push-failed", `GitHub push failed: ${message}.`, { error: message });
    } finally {
      setSaving(false);
    }
  }

  function resetToOriginal() {
    setDraftContent(content || "");
    setSelected(null);
    setEdits([]);
    setDraftId("");
    setCheckpointId("");
    setPatchState("not_generated");
    setPreviewBuildState("not_started");
    setPreviewUrl("");
    setPreviewId("");
    setPreviewBranch("");
    setDeploymentId("");
    setDeploymentUrlValue("");
    setPreviewLogs([]);
    setCommitSha("");
    setLastError("");
    setGeneratedContent("");
    onContentChange(content || "");
    window.localStorage.removeItem(draftKey(repo, branch, filePath));
    chatEvent("editor-reset", `Visual editor reset to original source truth for ${filePath || sourceRoute}.`);
  }

  const modeButtons: Array<{ id: ViewMode; label: string }> = [
    { id: "editor", label: "Front View" },
    { id: "browser", label: "Browser Review" },
    { id: "mobile", label: "Mobile" },
    { id: "advanced", label: "Advanced" },
    { id: "code", label: "Code" },
    { id: "split", label: "Split" },
  ];

  const reviewSrc = previewUrl ? reviewProxyUrl(previewUrl) : "";
  return (
    <section className={reviewFullscreen ? "visualEditor reviewFullscreen" : "visualEditor"}>
      <header className="editorHeader"><div><strong>{stationLabel} Visual Editing</strong><span>{repo || "No repo"} · {branch || "No branch"} · {sourceRoute} · {filePath || "No file"}</span></div><div className="modeButtons">{modeButtons.map((item) => <button key={item.id} type="button" className={viewMode === item.id ? "active" : ""} onClick={() => switchMode(item.id)}>{item.label}</button>)}</div></header>
      <div className="editorStatus"><span>Draft: {draftId || "not saved"}</span><span>Checkpoint: {checkpointId || "none"}</span><span>Patch: {patchState}</span><span>Preview: {previewBuildState}</span><span>Commit: {commitSha ? commitSha.slice(0, 8) : "none"}</span><span>Code selection: {codeSelection ? `${codeSelection.startLine}:${codeSelection.startColumn}` : "none"}</span></div>
      {lastError ? <div className="errorBox"><b>Failed</b><span>{lastError}</span><button type="button" onClick={saveDraft} disabled={saving}>Retry Save + Preview</button></div> : null}
      <div className="editorActions"><button type="button" onClick={saveDraft} disabled={saving || !ready}>{saving ? "Working…" : "Save Draft"}</button><button type="button" onClick={generatePatch} disabled={saving || !ready}>Generate Patch</button><button type="button" onClick={pushToGitHub} disabled={!pushReady}>Push GitHub</button><button type="button" onClick={resetToOriginal}>Reset</button><button type="button" onClick={refreshPreview}>Refresh</button><button type="button" onClick={() => setDrawerOpen((value) => !value)}>Operations</button></div>
      {viewMode === "editor" || viewMode === "advanced" ? <div className="previewPane"><iframe key={`editor-${frameKey}`} title="Editable frontend preview" src={editorUrl} /></div> : null}
      {viewMode === "mobile" ? <div className="mobilePane"><div className="phoneFrame"><iframe key={`mobile-${frameKey}`} title="Mobile editable preview" src={editorUrl} /></div></div> : null}
      {viewMode === "code" ? <div className="codePanel"><RuntimeCodeEditor repo={repo} branch={branch} filePath={filePath} sha="current" value={draftContent} onChange={handleCodeChange} onSelectionChange={setCodeSelection} /></div> : null}
      {viewMode === "split" ? <div className="splitMode"><div className="codePanel"><RuntimeCodeEditor repo={repo} branch={branch} filePath={filePath} sha="current" value={draftContent} onChange={handleCodeChange} onSelectionChange={setCodeSelection} /></div><div className="splitPreview">{previewUrl ? <iframe key={`split-${frameKey}`} title="Real temporary split preview" src={reviewSrc} /> : <div className="reviewPending"><b>Real temporary preview required</b><span>Save Draft to create a temporary Git branch, wait for Vercel, then review the exact result beside the code.</span></div>}</div></div> : null}
      {viewMode === "browser" ? <div className={reviewFullscreen ? "browserReview full" : "browserReview"}><div className="reviewToolbar"><button type="button" className={reviewDevice === "desktop" ? "active" : ""} onClick={() => updateReviewMode({ device: "desktop" })}>Desktop</button><button type="button" className={reviewDevice === "iphone-14-pro-max" ? "active" : ""} onClick={() => updateReviewMode({ device: "iphone-14-pro-max" })}>iPhone 14 Pro Max</button><button type="button" className={reviewBrowser === "safari" ? "active" : ""} onClick={() => updateReviewMode({ browser: "safari" })}>Safari</button><button type="button" className={reviewBrowser === "chrome" ? "active" : ""} onClick={() => updateReviewMode({ browser: "chrome" })}>Chrome</button><button type="button" onClick={() => updateReviewMode({ fullscreen: !reviewFullscreen })}>{reviewFullscreen ? "Exit Full Screen" : "Full Screen"}</button><button type="button" className={reviewSafeZone ? "active" : ""} onClick={() => updateReviewMode({ safeZone: !reviewSafeZone })}>Safe Zone</button></div><div className={`reviewFrame ${reviewDevice} ${reviewBrowser}`}>{reviewSafeZone ? <div className="safeZoneOverlay"><span>Safe zone</span></div> : null}{previewUrl ? <iframe key={`review-${frameKey}`} title="Real temporary Browser Review" src={reviewSrc} /> : <div className="reviewPending"><b>No real temporary preview yet</b><span>Save Draft to generate the patch, create a temporary Git branch, and wait for Vercel.</span></div>}</div><aside className="reviewPanel"><b>Real Temporary Preview</b><span>Status: {previewBuildState}</span><span>URL: {previewUrl || "not ready"}</span><span>Branch: {previewBranch || "not ready"}</span><span>Deployment: {deploymentId || "not ready"}</span><span>Push GitHub: {pushReady ? "ready" : "locked until preview succeeds and draft is unchanged"}</span><button type="button" onClick={pushToGitHub} disabled={!pushReady}>Push GitHub</button></aside></div> : null}
      {drawerOpen ? <aside className="advancedDrawer"><b>Advanced source state</b><span>Source truth: {sourceTruthId}</span><span>Preview ID: {previewId || "none"}</span><span>Preview branch: {previewBranch || "none"}</span><span>Deployment ID: {deploymentId || "none"}</span><span>Preview logs: {previewLogs.length}</span><span>Selected: {selected?.selector || selected?.kind || "none"}</span><span>Edits: {edits.length}</span><span>Generated draft current: {generatedContent === draftContent ? "yes" : "no"}</span></aside> : null}
      <style jsx>{`.visualEditor{height:100%;min-height:580px;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr);background:#07101f;color:#fff;overflow:hidden}.editorHeader{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.16)}.editorHeader div:first-child{display:grid;gap:2px}.editorHeader strong{font-size:12px}.editorHeader span,.editorStatus span,.reviewPanel span,.advancedDrawer span{font-size:9px;color:#94a3b8}.modeButtons,.editorActions,.reviewToolbar{display:flex;gap:5px;align-items:center;overflow:auto}.modeButtons button,.editorActions button,.reviewToolbar button,.reviewPanel button,.errorBox button{height:28px;border:1px solid rgba(148,163,184,.25);border-radius:7px;background:#111c31;color:#dbeafe;font-size:9px;font-weight:900;padding:0 9px}.modeButtons button.active,.reviewToolbar button.active{background:#2563eb;border-color:#60a5fa;color:#fff}.editorStatus{display:flex;gap:12px;padding:5px 10px;border-bottom:1px solid rgba(148,163,184,.12);overflow:auto}.editorActions{padding:6px 10px;border-bottom:1px solid rgba(148,163,184,.12)}button:disabled{opacity:.4;cursor:not-allowed}.errorBox{display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(127,29,29,.36);border-bottom:1px solid rgba(248,113,113,.34);font-size:10px}.errorBox b{color:#fca5a5}.errorBox span{color:#fecaca;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.previewPane,.codePanel,.splitPreview,.browserReview,.mobilePane{min-height:0;overflow:hidden}.previewPane iframe,.splitPreview iframe,.reviewFrame iframe{width:100%;height:100%;border:0;background:#fff}.mobilePane{display:grid;place-items:center;padding:10px;overflow:auto}.phoneFrame{width:430px;height:740px;max-width:96%;border:10px solid #111827;border-radius:34px;overflow:hidden;background:#fff}.phoneFrame iframe{width:100%;height:100%;border:0}.splitMode{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;padding:8px}.browserReview{display:grid;grid-template-columns:minmax(0,1fr) 240px;grid-template-rows:auto minmax(0,1fr);gap:0}.reviewToolbar{grid-column:1/-1;padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.14)}.reviewFrame{position:relative;min-width:0;min-height:0;background:#0f172a;overflow:auto;display:grid;place-items:center}.reviewFrame.desktop iframe{width:100%;height:100%}.reviewFrame.iphone-14-pro-max iframe{width:430px;height:932px;max-width:96%;border:10px solid #111827;border-radius:34px}.reviewFrame.safari{box-shadow:inset 0 34px 0 #e5e7eb}.reviewFrame.chrome{box-shadow:inset 0 34px 0 #1f2937}.safeZoneOverlay{position:absolute;z-index:5;inset:72px 7% 42px;border:2px dashed #f59e0b;pointer-events:none}.safeZoneOverlay span{background:#f59e0b;color:#111827;font-size:9px;font-weight:900;padding:2px 5px}.reviewPanel{display:grid;align-content:start;gap:7px;padding:10px;border-left:1px solid rgba(148,163,184,.16);background:#08111f}.reviewPending{height:100%;display:grid;place-content:center;gap:8px;padding:30px;text-align:center;color:#cbd5e1}.reviewPending span{font-size:10px;color:#94a3b8}.advancedDrawer{position:absolute;right:10px;top:110px;z-index:20;width:280px;display:grid;gap:7px;padding:10px;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:#08111f;box-shadow:0 18px 50px rgba(0,0,0,.45)}.reviewFullscreen{position:fixed;inset:0;z-index:50000;min-height:100dvh}.reviewFullscreen .browserReview{height:calc(100dvh - 120px)}@media(max-width:900px){.splitMode{grid-template-columns:1fr;overflow:auto}.browserReview{grid-template-columns:1fr}.reviewPanel{border-left:0;border-top:1px solid rgba(148,163,184,.16)}.editorHeader{align-items:flex-start;flex-direction:column}}`}</style>
    </section>
  );
}
