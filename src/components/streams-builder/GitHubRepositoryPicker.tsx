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
  const [status, setStatus] = useState("Select repo, folder, file, then Pull.");
  const [busy, setBusy] = useState(false);

  const folders = useMemo(() => unique(files.map((file) => file.directory)), [files]);
  const folderFiles = useMemo(() => files.filter((file) => file.directory === folder), [files, folder]);
  const selectedRepo = useMemo(() => repos.find((item) => item.fullName === repo), [repos, repo]);
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
      setStatus(`Pulled visible active file: ${selectedFullPath}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  async function pushFile() {
    if (!canPush || !activeFile?.sha) {
      setStatus("Push blocked until pulled file matches visible selected file and content changed.");
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
      setStatus(`Pushed GitHub commit: ${json.commitSha || "commit"}`);
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
    <section className="repoWorkspace">
      <div className="repoControls">
        <label><b>Repo</b><select value={repo} onChange={(event) => { const next = event.target.value; const found = repos.find((item) => item.fullName === next); setRepo(next); setBranch(found?.defaultBranch || "main"); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select></label>
        <label><b>Folder</b><select value={folder} onChange={(event) => { const next = event.target.value; const first = files.find((item) => item.directory === next); setFolder(next); setFilePath(first?.path || ""); setActiveFile(null); setContent(""); }}><option value="">folder</option>{folders.map((item) => <option key={item} value={item}>📁 {item}</option>)}</select></label>
        <label><b>File</b><select value={filePath} onChange={(event) => { setFilePath(event.target.value); setActiveFile(null); setContent(""); }}><option value="">file</option>{folderFiles.map((item) => <option key={item.path} value={item.path}>📄 {item.name} · {item.sha.slice(0, 7)}</option>)}</select></label>
        <label><b>Branch</b><input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch" /></label>
        <button type="button" onClick={pullFile} disabled={busy || !filePath}>Pull</button>
        <button type="button" onClick={pushFile} disabled={busy || !canPush}>Push</button>
      </div>
      <div className="proofRow"><span>FULL PATH</span><b>{selectedFullPath || "none"}</b><span>WRITE TARGET</span><b>{repo && branch && selectedFullPath ? `${repo}@${branch}:${selectedFullPath}` : "none"}</b><span>LOCK</span><b>{activeMatchesSelection ? "Visible selected file" : "Pull required"}</b></div>
      <textarea className="fileEditor" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Pulled file opens here." readOnly={!activeMatchesSelection} spellCheck={false} />
      <p className="status">{status}</p>
      <style jsx>{`
        .repoWorkspace{min-width:0;min-height:0;height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:6px;overflow:hidden;}
        .repoControls{display:grid;grid-template-columns:1.2fr 1.2fr 1fr .5fr auto auto;gap:6px;align-items:end;}
        label{min-width:0;border:1px solid rgba(148,163,184,.14);border-radius:10px;background:#020617;padding:6px;}label b,.proofRow span{display:block;color:#6ee7b7;font-size:9px;font-weight:900;text-transform:uppercase;margin-bottom:3px;}
        select,input{width:100%;min-width:0;border:0;background:transparent;color:#fff;font-size:11px;outline:none;}option{color:#020617;}button{height:36px;border:0;border-radius:9px;background:#7c3aed;color:#fff;font-size:11px;font-weight:900;padding:0 13px;cursor:pointer;}button:disabled{opacity:.45;cursor:not-allowed;}
        .proofRow{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(0,1.4fr) auto minmax(0,.8fr);gap:6px;align-items:center;border:1px solid rgba(16,185,129,.22);border-radius:10px;background:rgba(6,78,59,.13);padding:6px;}.proofRow b{min-width:0;color:#fff;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fileEditor{min-width:0;min-height:0;width:100%;height:100%;border:1px solid rgba(148,163,184,.14);border-radius:12px;background:#020617;color:#e5e7eb;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-size:12px;line-height:1.5;padding:12px;resize:none;box-sizing:border-box;}.status{margin:0;color:#cbd5e1;font-size:10px;}
      `}</style>
    </section>
  );
}
