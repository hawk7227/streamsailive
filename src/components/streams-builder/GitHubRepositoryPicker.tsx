"use client";

import { useEffect, useMemo, useState } from "react";
import { clearBuilderSourceTruth, createLockToken, readBuilderSourceTruth, targetMatchesSourceTruth, writeBuilderSourceTruth } from "./builderLiveSourceTruth";

type Repo = { id: number; fullName: string; defaultBranch: string };
type TreeFile = { path: string; sha: string; directory: string; name: string };
type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type FileResult = { ok: boolean; error?: string; path?: string; sha?: string; content?: string; frontendRoute?: string; commitSha?: string };

type PushRequestDetail = { message?: string };

async function readJson(response: Response) { const text = await response.text(); try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 140)); } }
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b)); }
function basename(path: string) { return path.split("/").filter(Boolean).pop() || path; }
function dirname(path: string) { const parts = path.split("/"); parts.pop(); return parts.join("/"); }
function readStoredActiveFile() { if (typeof window === "undefined") return null; try { const raw = window.localStorage.getItem("streams-builder:active-file"); return raw ? JSON.parse(raw) as PulledFileDetail : null; } catch { return null; } }
function emitPulledFile(detail: PulledFileDetail) { window.localStorage.setItem("streams-builder:active-file", JSON.stringify(detail)); window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail })); }

export default function GitHubRepositoryPicker() {
  const stored = typeof window === "undefined" ? null : readStoredActiveFile();
  const [expanded, setExpanded] = useState(Boolean(readBuilderSourceTruth()?.mode === "github-file"));
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState(stored?.repo || "");
  const [branch, setBranch] = useState(stored?.branch || "");
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [folder, setFolder] = useState(stored?.folder || (stored?.path ? dirname(stored.path) : ""));
  const [filePath, setFilePath] = useState(stored?.path || "");
  const [activeFile, setActiveFile] = useState<FileResult | null>(stored?.path ? { ok: true, path: stored.path, sha: stored.sha, content: stored.content } : null);
  const [content, setContent] = useState(stored?.content || "");
  const [status, setStatus] = useState(stored?.path ? `Locked · ${stored.repo}@${stored.branch}:${stored.path}` : "Brainstorm mode · no GitHub file locked");
  const [busy, setBusy] = useState(false);
  const [pushRequested, setPushRequested] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const folders = useMemo(() => unique(files.map((file) => file.directory)), [files]);
  const folderFiles = useMemo(() => files.filter((file) => file.directory === folder), [files, folder]);
  const selectedFile = useMemo(() => files.find((file) => file.path === filePath), [files, filePath]);
  const selectedFullPath = selectedFile?.path || filePath;
  const truth = readBuilderSourceTruth();
  const activeMatchesSelection = Boolean(activeFile?.path && activeFile.path === selectedFullPath && targetMatchesSourceTruth(truth, { repo, branch, filePath: selectedFullPath, sourceSha: activeFile.sha, lockToken: truth?.lockToken }));
  const dirty = Boolean(activeMatchesSelection && activeFile?.content !== undefined && content !== activeFile.content);

  function unlock() {
    setActiveFile(null); setContent(""); setPushRequested(false); setPushMessage("");
    window.localStorage.removeItem("streams-builder:active-file");
    clearBuilderSourceTruth("/");
    setStatus("Brainstorm mode · no GitHub file locked");
  }

  async function loadRepos() {
    setBusy(true);
    try {
      const json = await readJson(await fetch("/api/streams-builder/github/repos", { cache: "no-store" }));
      if (!json.ok) throw new Error(json.error || "Unable to load repos");
      const nextRepos = json.repos || [];
      setRepos(nextRepos);
      const saved = readStoredActiveFile();
      if (saved?.repo && nextRepos.some((item: Repo) => item.fullName === saved.repo)) {
        setRepo(saved.repo); setBranch(saved.branch || nextRepos.find((item: Repo) => item.fullName === saved.repo)?.defaultBranch || "main"); setFolder(saved.folder || dirname(saved.path)); setFilePath(saved.path); setActiveFile({ ok: true, path: saved.path, sha: saved.sha, content: saved.content }); setContent(saved.content || "");
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load repos"); } finally { setBusy(false); }
  }

  async function loadTree(nextRepo = repo, nextBranch = branch) {
    if (!nextRepo) return;
    setBusy(true);
    const saved = readStoredActiveFile();
    const keepSaved = Boolean(saved?.repo === nextRepo && saved?.branch === nextBranch);
    if (!keepSaved) { setActiveFile(null); setContent(""); }
    try {
      const previousPath = keepSaved ? saved?.path || filePath : filePath;
      const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch || "main" });
      const json = await readJson(await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" }));
      if (!json.ok) throw new Error(json.error || "Unable to load tree");
      const nextFiles = json.files || [];
      setFiles(nextFiles);
      const preserved = previousPath ? nextFiles.find((item: TreeFile) => item.path === previousPath) : null;
      const first = preserved || nextFiles.find((item: TreeFile) => item.path === "src/app/page.tsx") || nextFiles[0];
      if (first) { setFolder(first.directory || dirname(first.path)); setFilePath(first.path); }
      setStatus("Choose the exact file, then Pull to lock it.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load tree"); } finally { setBusy(false); }
  }

  async function pullFile() {
    if (!repo || !branch || !selectedFullPath) { setStatus("Select repo, branch, folder, and file first."); return; }
    setBusy(true);
    try {
      const params = new URLSearchParams({ repo, ref: branch, path: selectedFullPath });
      const json = await readJson(await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" })) as FileResult;
      if (!json.ok) throw new Error(json.error || "Pull failed");
      if ((json.path || selectedFullPath) !== selectedFullPath) throw new Error(`Pull blocked: selected ${selectedFullPath}, received ${json.path || "unknown"}.`);
      const nextContent = json.content || "";
      const nextSha = json.sha || selectedFile?.sha || "";
      const nextFolder = selectedFile?.directory || folder || dirname(selectedFullPath);
      const nextRoute = json.frontendRoute || "/";
      const lockToken = createLockToken({ repo, branch, filePath: selectedFullPath, sourceSha: nextSha });
      setActiveFile(json); setContent(nextContent); setPushRequested(false); setPushMessage("");
      emitPulledFile({ repo, branch, path: selectedFullPath, folder: nextFolder, sha: nextSha, content: nextContent, route: nextRoute });
      writeBuilderSourceTruth({ mode: "github-file", repo, branch, folder: nextFolder, filePath: selectedFullPath, sourceSha: nextSha, lockToken, lockedAt: new Date().toISOString(), route: nextRoute, draftRevision: 0, selectedRange: null });
      setExpanded(true);
      setStatus(`Locked · ${repo}@${branch}:${selectedFullPath} · ${nextSha.slice(0, 7)}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Pull failed"); } finally { setBusy(false); }
  }

  async function approveAndPush() {
    const currentTruth = readBuilderSourceTruth();
    if (!activeMatchesSelection || !dirty || !activeFile?.sha || !currentTruth) { setStatus("Push blocked: pull, lock, and change the visible file first."); return; }
    if (!targetMatchesSourceTruth(currentTruth, { repo, branch, filePath: selectedFullPath, sourceSha: activeFile.sha, lockToken: currentTruth.lockToken })) { setStatus("Push blocked: visible source lock changed. Re-pull the file."); return; }
    setBusy(true);
    try {
      const verifyParams = new URLSearchParams({ repo, ref: branch, path: selectedFullPath });
      const remote = await readJson(await fetch(`/api/streams-builder/github/file?${verifyParams.toString()}`, { cache: "no-store" })) as FileResult;
      if (!remote.ok) throw new Error(remote.error || "Remote verification failed");
      if (remote.sha !== activeFile.sha) throw new Error(`Push blocked: remote SHA changed from ${activeFile.sha.slice(0, 7)} to ${(remote.sha || "unknown").slice(0, 7)}. Re-pull before pushing.`);

      const pushed = await readJson(await fetch("/api/streams-builder/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ repo, branch, path: selectedFullPath, sha: activeFile.sha, content, agent: "Streams AI Chat", message: pushMessage || `Streams AI: update ${selectedFullPath}`, approvalGranted: true, lockToken: currentTruth.lockToken, sourceSha: currentTruth.sourceSha }),
      })) as FileResult;
      if (!pushed.ok) throw new Error(pushed.error || "Push failed");
      setStatus(`Pushed · ${pushed.commitSha || "commit"} · refreshing source truth`);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "github.push.completed", message: `GitHub push completed for ${repo}@${branch}:${selectedFullPath} · ${pushed.commitSha || "commit"}` } }));
      await pullFile();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Push failed"); } finally { setBusy(false); }
  }

  useEffect(() => { void loadRepos(); }, []);
  useEffect(() => { if (repo && branch) void loadTree(repo, branch); }, [repo, branch]);
  useEffect(() => {
    function onSharedSource(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (!detail || detail.repo !== repo || detail.branch !== branch || detail.path !== selectedFullPath) return;
      setContent(detail.content || "");
      setStatus(`Unsaved changes · ${detail.path}`);
    }
    function onPushRequest(event: Event) {
      const detail = (event as CustomEvent<PushRequestDetail>).detail || {};
      if (!activeMatchesSelection) { setStatus("Push request blocked: no visibly locked GitHub file."); return; }
      setPushRequested(true); setExpanded(true); setPushMessage(String(detail.message || ""));
      setStatus("Push approval required · review the visible diff, then Approve & Push.");
    }
    window.addEventListener("streams-builder:shared-source-change", onSharedSource);
    window.addEventListener("streams-builder:push-approval-request", onPushRequest);
    return () => { window.removeEventListener("streams-builder:shared-source-change", onSharedSource); window.removeEventListener("streams-builder:push-approval-request", onPushRequest); };
  }, [repo, branch, selectedFullPath, activeMatchesSelection]);

  return (
    <section className={expanded ? "githubSourceControl expanded" : "githubSourceControl"} aria-label="GitHub source lock controls" onFocusCapture={() => setExpanded(true)}>
      <button type="button" className="githubToggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} title={activeMatchesSelection ? status : "Open GitHub source controls"}>
        <span className={activeMatchesSelection ? "lockDot locked" : "lockDot"} />
        <b>{activeMatchesSelection ? basename(selectedFullPath) : "GitHub"}</b>
        <small>{activeMatchesSelection ? `${branch} · ${activeFile?.sha?.slice(0, 7) || "locked"}${dirty ? " · changed" : ""}` : "optional"}</small>
      </button>
      {expanded ? <div className="topControlStrip">
        <label><b>Repo</b><select value={repo} onChange={(event) => { unlock(); const next = event.target.value; const found = repos.find((item) => item.fullName === next); setRepo(next); setBranch(found?.defaultBranch || "main"); setFilePath(""); setFolder(""); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select></label>
        <label><b>Folder</b><select value={folder} onChange={(event) => { unlock(); const next = event.target.value; const first = files.find((item) => item.directory === next); setFolder(next); setFilePath(first?.path || ""); }}><option value="">folder</option>{folders.map((item) => <option key={item} value={item}>📁 {item}</option>)}</select></label>
        <label><b>File</b><select value={filePath} onChange={(event) => { unlock(); const nextPath = event.target.value; const found = files.find((item) => item.path === nextPath); setFilePath(nextPath); setFolder(found?.directory || dirname(nextPath)); }}><option value="">file</option>{folderFiles.map((item) => <option key={item.path} value={item.path}>📄 {basename(item.path)} · {item.sha.slice(0, 7)}</option>)}</select></label>
        <label><b>Branch</b><input value={branch} onChange={(event) => { unlock(); setBranch(event.target.value); }} placeholder="branch" /></label>
        <div className="lockReadout"><span className={activeMatchesSelection ? "lockDot locked" : "lockDot"}/><b>{activeMatchesSelection ? dirty ? "Changed" : "Locked" : "Not locked"}</b></div>
        <button type="button" onClick={pullFile} disabled={busy || !filePath}>Pull + Lock</button>
        {activeMatchesSelection && dirty && pushRequested ? <button type="button" className="approve" onClick={approveAndPush} disabled={busy}>Approve & Push</button> : null}
        {activeMatchesSelection ? <button type="button" className="secondary" onClick={unlock} disabled={busy}>Unlock</button> : null}
        <small>{status}</small>
      </div> : null}
      <style jsx>{`
        .githubSourceControl{min-width:0;display:flex;align-items:center;flex:1}.githubSourceControl.expanded{width:100%}.githubToggle{height:30px;display:flex;align-items:center;gap:7px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#0b1220;color:#fff;padding:0 9px;cursor:pointer;white-space:nowrap}.githubToggle b{font-size:10px}.githubToggle small{font-size:8px;color:#94a3b8}.lockDot{width:8px;height:8px;border-radius:50%;background:#64748b;box-shadow:0 0 0 2px rgba(100,116,139,.18)}.lockDot.locked{background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.18),0 0 10px rgba(34,197,94,.55)}
        .topControlStrip{min-width:0;width:100%;min-height:36px;display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(150px,1.1fr) minmax(180px,1.35fr) minmax(100px,.75fr) auto auto auto auto minmax(160px,.8fr);gap:8px;align-items:center;overflow:visible;background:transparent;padding-left:8px;box-sizing:border-box}.topControlStrip label{min-width:0;height:30px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:center;border-bottom:1px solid rgba(148,163,184,.34)}.topControlStrip b{color:#6ee7b7;font-size:8px;text-transform:uppercase}.topControlStrip select,.topControlStrip input{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:10px;outline:none}.topControlStrip option{color:#020617}.topControlStrip button{height:28px;border:0;border-radius:7px;background:#7c3aed;color:#fff;font-size:9px;font-weight:900;padding:0 10px}.topControlStrip button.approve{background:#16a34a}.topControlStrip button.secondary{background:#1e293b}.topControlStrip button:disabled{opacity:.42}.topControlStrip small{min-width:0;color:#94a3b8;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lockReadout{display:flex;align-items:center;gap:6px;white-space:nowrap}.lockReadout b{color:#cbd5e1}
        @media(max-width:1250px){.topControlStrip{grid-template-columns:minmax(130px,1fr) minmax(130px,1fr) minmax(150px,1.2fr) 90px auto auto auto}.topControlStrip small{display:none}.lockReadout{display:none}}
      `}</style>
    </section>
  );
}
