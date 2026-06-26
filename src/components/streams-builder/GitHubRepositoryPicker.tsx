"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; fullName: string; defaultBranch: string };
type TreeFile = { path: string; sha: string; directory: string; name: string };
type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };

type FileResult = {
  ok: boolean;
  error?: string;
  path?: string;
  sha?: string;
  content?: string;
  frontendRoute?: string;
};

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 140)); }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function basename(path: string) {
  return path.split("/").filter(Boolean).pop() || path;
}

function dirname(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function readStoredActiveFile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as PulledFileDetail : null;
  } catch {
    return null;
  }
}

function emitPulledFile(detail: PulledFileDetail) {
  window.localStorage.setItem("streams-builder:active-file", JSON.stringify(detail));
  window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail }));
}

export default function GitHubRepositoryPicker() {
  const stored = typeof window === "undefined" ? null : readStoredActiveFile();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState(stored?.repo || "");
  const [branch, setBranch] = useState(stored?.branch || "");
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [folder, setFolder] = useState(stored?.folder || (stored?.path ? dirname(stored.path) : ""));
  const [filePath, setFilePath] = useState(stored?.path || "");
  const [activeFile, setActiveFile] = useState<FileResult | null>(stored?.path ? { ok: true, path: stored.path, sha: stored.sha, content: stored.content } : null);
  const [content, setContent] = useState(stored?.content || "");
  const [status, setStatus] = useState(stored?.path ? `Restored active file: ${stored.repo}@${stored.branch}:${stored.path}` : "Select repo, branch, folder, and file.");
  const [busy, setBusy] = useState(false);

  const folders = useMemo(() => unique(files.map((file) => file.directory)), [files]);
  const folderFiles = useMemo(() => files.filter((file) => file.directory === folder), [files, folder]);
  const selectedFile = useMemo(() => files.find((file) => file.path === filePath), [files, filePath]);
  const selectedFullPath = selectedFile?.path || filePath;
  const activeMatchesSelection = Boolean(activeFile?.path && activeFile.path === selectedFullPath);
  const canPush = Boolean(activeMatchesSelection && activeFile?.sha && content !== (activeFile.content || ""));

  async function loadRepos() {
    setBusy(true);
    try {
      const json = await readJson(await fetch("/api/streams-builder/github/repos", { cache: "no-store" }));
      if (!json.ok) throw new Error(json.error || "Unable to load repos");
      const nextRepos = json.repos || [];
      setRepos(nextRepos);
      const saved = readStoredActiveFile();
      if (saved?.repo && nextRepos.some((item: Repo) => item.fullName === saved.repo)) {
        setRepo(saved.repo);
        setBranch(saved.branch || nextRepos.find((item: Repo) => item.fullName === saved.repo)?.defaultBranch || "main");
        setFolder(saved.folder || dirname(saved.path));
        setFilePath(saved.path);
        setActiveFile({ ok: true, path: saved.path, sha: saved.sha, content: saved.content });
        setContent(saved.content || "");
        setStatus(`Restored source truth: ${saved.repo}@${saved.branch}:${saved.path}`);
      } else {
        setStatus("Repos loaded. Select a repo, then Pull. No repo is hardcoded.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load repos");
    } finally {
      setBusy(false);
    }
  }

  async function loadTree(nextRepo = repo, nextBranch = branch) {
    if (!nextRepo) return;
    setBusy(true);
    const saved = readStoredActiveFile();
    const keepSaved = Boolean(saved?.repo === nextRepo && saved?.branch === nextBranch);
    if (!keepSaved) {
      setActiveFile(null);
      setContent("");
    }
    try {
      const previousPath = keepSaved ? saved?.path || filePath : filePath;
      const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch || "main" });
      const json = await readJson(await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" }));
      if (!json.ok) throw new Error(json.error || "Unable to load tree");
      const nextFiles = json.files || [];
      setFiles(nextFiles);
      const preserved = previousPath ? nextFiles.find((item: TreeFile) => item.path === previousPath) : null;
      const first = preserved || nextFiles.find((item: TreeFile) => item.path === "src/app/page.tsx") || nextFiles[0];
      if (first) {
        setFolder(first.directory || dirname(first.path));
        setFilePath(first.path);
      }
      setStatus(`Tree loaded: ${nextFiles.length} files.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load tree");
    } finally {
      setBusy(false);
    }
  }

  async function pullFile() {
    if (!repo || !branch || !selectedFullPath) {
      setStatus("Select repo, branch, folder, and file first.");
      return;
    }
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
      setActiveFile(json);
      setContent(nextContent);
      emitPulledFile({ repo, branch, path: selectedFullPath, folder: nextFolder, sha: nextSha, content: nextContent, route: nextRoute });
      setStatus(`Pulled into Agent 1: ${selectedFullPath}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  async function pushFile() {
    if (!canPush || !activeFile?.sha) {
      setStatus("Push blocked until selected file is pulled and changed.");
      return;
    }
    setBusy(true);
    try {
      const json = await readJson(await fetch("/api/streams-builder/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ repo, branch, path: selectedFullPath, sha: activeFile.sha, content, agent: "Agent 1", message: `Agent 1: update ${selectedFullPath}` }),
      }));
      if (!json.ok) throw new Error(json.error || "Push failed");
      setStatus(`Pushed: ${json.commitSha || "commit"}`);
      await pullFile();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Push failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadRepos(); }, []);
  useEffect(() => { if (repo && branch) void loadTree(repo, branch); }, [repo, branch]);

  return (
    <section className="topControlStrip" aria-label="GitHub workspace controls">
      <label><b>Repo</b><select value={repo} onChange={(event) => { const next = event.target.value; const found = repos.find((item) => item.fullName === next); setRepo(next); setBranch(found?.defaultBranch || "main"); setFilePath(""); setFolder(""); setActiveFile(null); setContent(""); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select></label>
      <label><b>Folder</b><select value={folder} onChange={(event) => { const next = event.target.value; const first = files.find((item) => item.directory === next); setFolder(next); setFilePath(first?.path || ""); setActiveFile(null); setContent(""); }}><option value="">folder</option>{folders.map((item) => <option key={item} value={item}>📁 {item}</option>)}</select></label>
      <label><b>File</b><select value={filePath} onChange={(event) => { const nextPath = event.target.value; const found = files.find((item) => item.path === nextPath); setFilePath(nextPath); setFolder(found?.directory || dirname(nextPath)); setActiveFile(null); setContent(""); }}><option value="">file</option>{folderFiles.map((item) => <option key={item.path} value={item.path}>📄 {basename(item.path)} · {item.sha.slice(0, 7)}</option>)}</select></label>
      <label><b>Branch</b><input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch" /></label>
      <label><b>Lock</b><span>{activeMatchesSelection ? "open" : "pull"}</span></label>
      <button type="button" onClick={pullFile} disabled={busy || !filePath}>Pull</button>
      <button type="button" onClick={pushFile} disabled={busy || !canPush}>Push</button>
      <small>{status}</small>
      <style jsx>{`
        .topControlStrip{min-width:0;height:34px;display:grid;grid-template-columns:minmax(120px,1.1fr) minmax(140px,1.1fr) minmax(120px,1fr) 88px 70px auto auto minmax(120px,.7fr);gap:10px;align-items:center;overflow:hidden;background:transparent;border:0;padding:0 2px;box-sizing:border-box;}
        label{min-width:0;height:28px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:end;border:0;border-radius:0;background:transparent;padding:0;border-bottom:1px solid rgba(148,163,184,.34);}
        b{color:#6ee7b7;font-size:9px;font-weight:900;text-transform:uppercase;line-height:1;align-self:center;}
        select,input,span{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:11px;outline:none;padding:0 0 3px;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}option{color:#020617;}span{display:block;color:#cbd5e1;}
        button{height:28px;border:0;border-radius:7px;background:#7c3aed;color:#fff;font-size:10px;font-weight:900;padding:0 12px;cursor:pointer;}button:disabled{opacity:.42;cursor:not-allowed;}small{min-width:0;color:#94a3b8;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      `}</style>
    </section>
  );
}
