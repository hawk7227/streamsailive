"use client";

import { useEffect, useMemo, useState } from "react";
import { rankDiscoveryCandidates, type DiscoveryContext, type DiscoveryFile, type DiscoveryRepo } from "./builderSourceDiscovery";
import { clearBuilderSourceTruth, createLockToken, readBuilderSourceTruth, targetMatchesSourceTruth, writeBuilderSourceTruth } from "./builderLiveSourceTruth";

type Repo = DiscoveryRepo;
type TreeFile = DiscoveryFile & { directory: string; name: string };
type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type FileResult = { ok: boolean; error?: string; path?: string; sha?: string; content?: string; frontendRoute?: string; commitSha?: string };
type DiscoveryRequest = DiscoveryContext & { references?: string[]; scopeExpansion?: boolean };

async function readJson(response: Response) { const text = await response.text(); try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 180)); } }
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b)); }
function basename(path: string) { return path.split("/").filter(Boolean).pop() || path; }
function dirname(path: string) { const parts = path.split("/"); parts.pop(); return parts.join("/"); }
function readStoredActiveFile() { if (typeof window === "undefined") return null; try { const raw = window.localStorage.getItem("streams-builder:active-file"); return raw ? JSON.parse(raw) as PulledFileDetail : null; } catch { return null; } }
function readRecentFiles() { if (typeof window === "undefined") return []; try { const raw = window.localStorage.getItem("streams-builder:recent-files"); return raw ? JSON.parse(raw) as string[] : []; } catch { return []; } }
function rememberFile(path: string) { const next = [path, ...readRecentFiles().filter((item) => item !== path)].slice(0, 20); window.localStorage.setItem("streams-builder:recent-files", JSON.stringify(next)); }
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
  const [status, setStatus] = useState(stored?.path ? `Open · ${stored.repo}@${stored.branch}:${stored.path}` : "No GitHub file open");
  const [busy, setBusy] = useState(false);

  const folders = useMemo(() => unique(files.map((file) => file.directory)), [files]);
  const folderFiles = useMemo(() => files.filter((file) => file.directory === folder), [files, folder]);
  const selectedFile = useMemo(() => files.find((file) => file.path === filePath), [files, filePath]);
  const selectedFullPath = selectedFile?.path || filePath;
  const truth = readBuilderSourceTruth();
  const locked = Boolean(activeFile?.path && targetMatchesSourceTruth(truth, { repo, branch, filePath: selectedFullPath, sourceSha: activeFile.sha, lockToken: truth?.lockToken }));
  const candidateOpen = Boolean(activeFile?.path && activeFile.path === selectedFullPath && !locked);

  function clearOpenFile() {
    setActiveFile(null); setContent(""); setFilePath(""); setFolder("");
    window.localStorage.removeItem("streams-builder:active-file");
    clearBuilderSourceTruth("/");
    setStatus("No GitHub file open");
  }

  async function fetchRepos() {
    const json = await readJson(await fetch("/api/streams-builder/github/repos", { cache: "no-store" }));
    if (!json.ok) throw new Error(json.error || "Unable to load repositories");
    return (json.repos || []) as Repo[];
  }

  async function fetchTree(nextRepo: string, nextBranch: string) {
    const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch || "main" });
    const json = await readJson(await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" }));
    if (!json.ok) throw new Error(json.error || `Unable to load ${nextRepo}`);
    return (json.files || []) as TreeFile[];
  }

  async function loadRepos() {
    setBusy(true);
    try { const next = await fetchRepos(); setRepos(next); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load repositories"); }
    finally { setBusy(false); }
  }

  async function loadTree(nextRepo = repo, nextBranch = branch) {
    if (!nextRepo) return;
    setBusy(true);
    try {
      const nextFiles = await fetchTree(nextRepo, nextBranch || "main");
      setFiles(nextFiles);
      const preserved = filePath ? nextFiles.find((item) => item.path === filePath) : null;
      const first = preserved || nextFiles.find((item) => item.path === "src/app/page.tsx") || nextFiles[0];
      if (first) { setFolder(first.directory || dirname(first.path)); setFilePath(first.path); }
      setStatus("Choose a file and open it for verification.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load tree"); }
    finally { setBusy(false); }
  }

  async function openExactFile(targetRepo = repo, targetBranch = branch, targetPath = selectedFullPath, reason = "manual selection") {
    if (!targetRepo || !targetBranch || !targetPath) { setStatus("Repository, branch, and file are required."); return; }
    setBusy(true);
    try {
      const params = new URLSearchParams({ repo: targetRepo, ref: targetBranch, path: targetPath });
      const json = await readJson(await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" })) as FileResult;
      if (!json.ok) throw new Error(json.error || "Pull failed");
      if ((json.path || targetPath) !== targetPath) throw new Error(`Pull blocked: requested ${targetPath}, received ${json.path || "unknown"}.`);
      const nextContent = json.content || "";
      const nextSha = json.sha || "";
      const nextFolder = dirname(targetPath);
      const nextRoute = json.frontendRoute || "/";
      setRepo(targetRepo); setBranch(targetBranch); setFilePath(targetPath); setFolder(nextFolder); setActiveFile(json); setContent(nextContent); setExpanded(true);
      emitPulledFile({ repo: targetRepo, branch: targetBranch, path: targetPath, folder: nextFolder, sha: nextSha, content: nextContent, route: nextRoute });
      rememberFile(targetPath);
      clearBuilderSourceTruth(nextRoute);
      setStatus(`Verify · ${targetRepo}@${targetBranch}:${targetPath} · ${nextSha.slice(0, 7)}`);
      window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: { action: "focus" } }));
      window.dispatchEvent(new CustomEvent("streams-builder:open-view", { detail: { view: /\.(tsx|jsx|html?)$/i.test(targetPath) ? "frontend" : /(?:api|server|route|service)/i.test(targetPath) ? "backend" : "code", route: nextRoute, path: targetPath } }));
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "github.discovery.candidate-opened", message: `Located and opened ${targetRepo}@${targetBranch}:${targetPath} (${reason}). Review the preview, frontend/backend view, or code. Confirm it before the agent receives access.` } }));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to open file"); }
    finally { setBusy(false); }
  }

  function lockCandidate() {
    if (!candidateOpen || !activeFile?.sha || !selectedFullPath) { setStatus("Open and verify a candidate before locking it."); return; }
    const route = readStoredActiveFile()?.route || "/";
    const lockToken = createLockToken({ repo, branch, filePath: selectedFullPath, sourceSha: activeFile.sha });
    writeBuilderSourceTruth({ mode: "github-file", repo, branch, folder: folder || dirname(selectedFullPath), filePath: selectedFullPath, sourceSha: activeFile.sha, lockToken, lockedAt: new Date().toISOString(), route, draftRevision: 0, selectedRange: null });
    setStatus(`Locked · ${repo}@${branch}:${selectedFullPath} · ${activeFile.sha.slice(0, 7)}`);
    window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "github.source.locked", message: `Confirmed and locked ${repo}@${branch}:${selectedFullPath}. The agent can now see, pull, change, commit, and push only this file. Other repository files remain inaccessible unless you authorize a new discovery request and confirm its candidate.` } }));
  }

  async function discover(request: DiscoveryRequest) {
    setExpanded(true); setBusy(true); setStatus("Reasoning across conversation, screen evidence, recent work, and repository structure…");
    try {
      const availableRepos = repos.length ? repos : await fetchRepos();
      setRepos(availableRepos);
      const prioritized = [...availableRepos].sort((a, b) => Number(b.fullName === request.currentRepo) - Number(a.fullName === request.currentRepo)).slice(0, 8);
      const filesByRepo: Record<string, DiscoveryFile[]> = {};
      for (const item of prioritized) {
        const targetBranch = item.fullName === request.currentRepo && request.currentBranch ? request.currentBranch : item.defaultBranch || "main";
        try { filesByRepo[item.fullName] = await fetchTree(item.fullName, targetBranch); } catch { filesByRepo[item.fullName] = []; }
      }
      const ranked = rankDiscoveryCandidates(prioritized, filesByRepo, { ...request, recentFiles: [...readRecentFiles(), ...(request.references || [])] });
      const best = ranked[0];
      if (!best || best.score < 8) throw new Error("I could not identify a reliable candidate. Give me one more clue, such as visible text, the screen purpose, or a screenshot.");
      const bestRepo = prioritized.find((item) => item.fullName === best.repo);
      const tree = (filesByRepo[best.repo] || []) as TreeFile[];
      setFiles(tree);
      const found = tree.find((item) => item.path === best.file.path);
      setRepo(best.repo); setBranch(best.branch || bestRepo?.defaultBranch || "main"); setFolder(found?.directory || dirname(best.file.path)); setFilePath(best.file.path);
      await openExactFile(best.repo, best.branch || bestRepo?.defaultBranch || "main", best.file.path, `${best.reasons.join(", ") || "multi-signal match"}; confidence score ${best.score}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Source discovery failed";
      setStatus(message);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "github.discovery.needs-clue", message } }));
    } finally { setBusy(false); }
  }

  useEffect(() => { void loadRepos(); }, []);
  useEffect(() => { if (repo && branch) void loadTree(repo, branch); }, [repo, branch]);
  useEffect(() => {
    function onSharedSource(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (!detail || !locked || detail.repo !== repo || detail.branch !== branch || detail.path !== selectedFullPath) return;
      setContent(detail.content || "");
      setStatus(`Working · ${detail.path}`);
    }
    function onDiscover(event: Event) { void discover((event as CustomEvent<DiscoveryRequest>).detail || { prompt: "" }); }
    function onLock() { lockCandidate(); }
    function onOpenControls() { setExpanded(true); }
    window.addEventListener("streams-builder:shared-source-change", onSharedSource);
    window.addEventListener("streams-builder:github-discover", onDiscover);
    window.addEventListener("streams-builder:lock-candidate", onLock);
    window.addEventListener("streams-builder:github-open-controls", onOpenControls);
    return () => {
      window.removeEventListener("streams-builder:shared-source-change", onSharedSource);
      window.removeEventListener("streams-builder:github-discover", onDiscover);
      window.removeEventListener("streams-builder:lock-candidate", onLock);
      window.removeEventListener("streams-builder:github-open-controls", onOpenControls);
    };
  }, [repo, branch, selectedFullPath, locked, candidateOpen, activeFile?.sha, repos]);

  return (
    <section className={expanded ? "githubSourceControl expanded" : "githubSourceControl"} aria-label="GitHub source discovery and lock controls" onFocusCapture={() => setExpanded(true)}>
      <button type="button" className="githubToggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} title={status}>
        <span className={locked ? "lockDot locked" : candidateOpen ? "lockDot candidate" : "lockDot"} />
        <b>{selectedFullPath ? basename(selectedFullPath) : "GitHub"}</b>
        <small>{locked ? `${branch} · locked` : candidateOpen ? "verify candidate" : "contextual discovery"}</small>
      </button>
      {expanded ? <div className="topControlStrip">
        <label><b>Repo</b><select value={repo} onChange={(event) => { clearOpenFile(); const next = event.target.value; const found = repos.find((item) => item.fullName === next); setRepo(next); setBranch(found?.defaultBranch || "main"); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select></label>
        <label><b>Folder</b><select value={folder} onChange={(event) => { const next = event.target.value; const first = files.find((item) => item.directory === next); setFolder(next); setFilePath(first?.path || ""); }}><option value="">folder</option>{folders.map((item) => <option key={item} value={item}>📁 {item}</option>)}</select></label>
        <label><b>File</b><select value={filePath} onChange={(event) => { const nextPath = event.target.value; const found = files.find((item) => item.path === nextPath); setFilePath(nextPath); setFolder(found?.directory || dirname(nextPath)); }}><option value="">file</option>{folderFiles.map((item) => <option key={item.path} value={item.path}>📄 {basename(item.path)} · {item.sha.slice(0, 7)}</option>)}</select></label>
        <label><b>Branch</b><input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch" /></label>
        <div className="lockReadout"><span className={locked ? "lockDot locked" : candidateOpen ? "lockDot candidate" : "lockDot"}/><b>{locked ? "Locked" : candidateOpen ? "Verify" : "Closed"}</b></div>
        <button type="button" onClick={() => void openExactFile()} disabled={busy || !filePath}>Open</button>
        {candidateOpen ? <button type="button" className="lock" onClick={lockCandidate} disabled={busy}>Lock file + agent</button> : null}
        {selectedFullPath ? <button type="button" className="secondary" onClick={clearOpenFile} disabled={busy}>Close</button> : null}
        <small>{status}</small>
      </div> : null}
      <style jsx>{`
        .githubSourceControl{min-width:0;display:flex;align-items:center;flex:1}.githubSourceControl.expanded{width:100%}.githubToggle{height:30px;display:flex;align-items:center;gap:7px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#0b1220;color:#fff;padding:0 9px;cursor:pointer;white-space:nowrap}.githubToggle b{font-size:10px}.githubToggle small{font-size:8px;color:#94a3b8}.lockDot{width:8px;height:8px;border-radius:50%;background:#64748b;box-shadow:0 0 0 2px rgba(100,116,139,.18)}.lockDot.candidate{background:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.18)}.lockDot.locked{background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.18),0 0 10px rgba(34,197,94,.55)}
        .topControlStrip{min-width:0;width:100%;min-height:36px;display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(140px,1fr) minmax(180px,1.35fr) minmax(100px,.75fr) auto auto auto auto minmax(180px,.9fr);gap:8px;align-items:center;padding-left:8px;box-sizing:border-box}.topControlStrip label{min-width:0;height:30px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:center;border-bottom:1px solid rgba(148,163,184,.34)}.topControlStrip b{color:#6ee7b7;font-size:8px;text-transform:uppercase}.topControlStrip select,.topControlStrip input{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:10px;outline:none}.topControlStrip option{color:#020617}.topControlStrip button{height:28px;border:0;border-radius:7px;background:#7c3aed;color:#fff;font-size:9px;font-weight:900;padding:0 10px}.topControlStrip button.lock{background:#16a34a}.topControlStrip button.secondary{background:#1e293b}.topControlStrip button:disabled{opacity:.42}.topControlStrip small{min-width:0;color:#94a3b8;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lockReadout{display:flex;align-items:center;gap:6px;white-space:nowrap}.lockReadout b{color:#cbd5e1}@media(max-width:1250px){.topControlStrip{grid-template-columns:minmax(130px,1fr) minmax(130px,1fr) minmax(150px,1.2fr) 90px auto auto auto}.topControlStrip small{display:none}.lockReadout{display:none}}
      `}</style>
    </section>
  );
}
