"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; fullName: string; defaultBranch: string };
type TreeFile = { path: string; sha: string; directory: string; name: string };

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

export default function GitHubRepositoryPicker() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [folder, setFolder] = useState("");
  const [filePath, setFilePath] = useState("");
  const [activeFile, setActiveFile] = useState<FileResult | null>(null);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  const folders = useMemo(() => unique(files.map((file) => file.directory)), [files]);
  const folderFiles = useMemo(() => files.filter((file) => file.directory === folder), [files, folder]);
  const selectedFile = useMemo(() => files.find((file) => file.path === filePath), [files, filePath]);
  const selectedFullPath = folder && selectedFile ? `${folder}/${selectedFile.name || basename(selectedFile.path)}` : filePath;
  const activeMatchesSelection = Boolean(activeFile?.path && activeFile.path === selectedFullPath);
  const canPush = Boolean(activeMatchesSelection && activeFile?.sha && content !== (activeFile.content || ""));

  async function loadRepos() {
    setBusy(true);
    try {
      const json = await readJson(await fetch("/api/streams-builder/github/repos", { cache: "no-store" }));
      if (!json.ok) throw new Error(json.error || "Unable to load repos");
      const nextRepos = json.repos || [];
      setRepos(nextRepos);
      if (nextRepos[0]) {
        setRepo(nextRepos[0].fullName);
        setBranch(nextRepos[0].defaultBranch || "main");
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
    setActiveFile(null);
    setContent("");
    try {
      const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch || "main" });
      const json = await readJson(await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" }));
      if (!json.ok) throw new Error(json.error || "Unable to load tree");
      const nextFiles = json.files || [];
      setFiles(nextFiles);
      const first = nextFiles.find((item: TreeFile) => item.path.includes("streams-builder")) || nextFiles[0];
      setFolder(first?.directory || "");
      setFilePath(first?.path || "");
      setStatus(`Tree loaded: ${nextFiles.length} files.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load tree");
    } finally {
      setBusy(false);
    }
  }

  async function pullFile() {
    if (!repo || !branch || !folder || !selectedFile || !selectedFullPath) {
      setStatus("Select repo, branch, folder, and file first.");
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ repo, ref: branch, path: selectedFullPath });
      const json = await readJson(await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" })) as FileResult;
      if (!json.ok) throw new Error(json.error || "Pull failed");
      if ((json.path || selectedFullPath) !== selectedFullPath) throw new Error("Pull blocked: returned path does not match selected file.");
      setActiveFile(json);
      setContent(json.content || "");
      setStatus(`Pulled: ${selectedFullPath}`);
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
      <label><b>Repo</b><select value={repo} onChange={(event) => { const next = event.target.value; const found = repos.find((item) => item.fullName === next); setRepo(next); setBranch(found?.defaultBranch || "main"); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select></label>
      <label><b>Folder</b><select value={folder} onChange={(event) => { const next = event.target.value; const first = files.find((item) => item.directory === next); setFolder(next); setFilePath(first?.path || ""); setActiveFile(null); setContent(""); }}><option value="">folder</option>{folders.map((item) => <option key={item} value={item}>📁 {item}</option>)}</select></label>
      <label><b>File</b><select value={filePath} onChange={(event) => { setFilePath(event.target.value); setActiveFile(null); setContent(""); }}><option value="">file</option>{folderFiles.map((item) => <option key={item.path} value={item.path}>📄 {item.name} · {item.sha.slice(0, 7)}</option>)}</select></label>
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
