"use client";

import { useEffect, useMemo, useState } from "react";
import VisualEditingWorkstation from "./VisualEditingWorkstation";

type Repo = { id: number; fullName: string; defaultBranch: string };
type TreeFile = { path: string; directory: string; name: string };
type FileResult = { ok: boolean; error?: string; path?: string; ref?: string; sha?: string; frontendRoute?: string; content?: string; sourceTruth?: { route?: string; file?: string } };
type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`); }
}

function readStoredActiveFile() {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as PulledFileDetail : null;
  } catch {
    return null;
  }
}

export default function AgentOneWorkstation() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState("hawk7227/streamsailive");
  const [branch, setBranch] = useState("main");
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [directory, setDirectory] = useState("src/app/about");
  const [filePath, setFilePath] = useState("src/app/about/page.tsx");
  const [fileSha, setFileSha] = useState("");
  const [route, setRoute] = useState("/");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [proofLog, setProofLog] = useState<string[]>([]);
  const [chatLog, setChatLog] = useState<string[]>([]);
  const [openedByTopPull, setOpenedByTopPull] = useState(false);

  const visibleFiles = useMemo(() => directory ? files.filter((item) => item.directory === directory) : files, [directory, files]);
  const previewRoute = route || "/";

  function openPulledFile(detail: PulledFileDetail) {
    setRepo(detail.repo);
    setBranch(detail.branch || "main");
    setDirectory(detail.folder || "");
    setFilePath(detail.path);
    setFileSha(detail.sha || "");
    setContent(detail.content || "");
    setRoute(detail.route || "/");
    setOpenedByTopPull(true);
    setStatus(`Opened from top Pull: ${detail.path}`);
    setProofLog((items) => [...items.slice(-12), `Top Pull opened ${detail.repo}@${detail.branch}:${detail.path}`]);
  }

  async function loadRepos() {
    setLoadingRepos(true);
    setError("");
    try {
      const response = await fetch("/api/streams-builder/github/repos", { cache: "no-store" });
      const json = await readJson(response);
      if (!json.ok) throw new Error(json.error || "Unable to load GitHub repositories");
      const nextRepos = json.repos || [];
      setRepos(nextRepos);
      const current = nextRepos.find((item: Repo) => item.fullName === repo) || nextRepos[0];
      if (current && !openedByTopPull) {
        setRepo(current.fullName);
        setBranch(current.defaultBranch || "main");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load GitHub repositories");
    } finally {
      setLoadingRepos(false);
    }
  }

  async function loadTree(nextRepo = repo, nextBranch = branch) {
    if (!nextRepo || !nextBranch) return;
    setLoadingTree(true);
    setError("");
    try {
      const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch });
      const response = await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" });
      const json = await readJson(response);
      if (!json.ok) throw new Error(json.error || "Unable to load repository files");
      const nextFiles = json.files || [];
      const nextDirectories = json.directories || [];
      setFiles(nextFiles);
      setDirectories(nextDirectories);
      if (!openedByTopPull) {
        const preferred =
          nextFiles.find((item: TreeFile) => item.path === filePath) ||
          nextFiles.find((item: TreeFile) => item.path.includes("src/app") && item.path.endsWith("page.tsx")) ||
          nextFiles.find((item: TreeFile) => item.path.includes("streams-builder")) ||
          nextFiles[0];
        if (preferred) {
          setDirectory(preferred.directory || "");
          setFilePath(preferred.path || "");
        }
      }
      setStatus(openedByTopPull ? `Opened from top Pull: ${filePath}` : `Tree loaded: ${nextFiles.length} files`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load repository files");
    } finally {
      setLoadingTree(false);
    }
  }

  async function pullFile() {
    if (!repo || !branch || !filePath) {
      setError("Select repo, branch, and file first.");
      return;
    }
    setLoadingFile(true);
    setError("");
    try {
      const params = new URLSearchParams({ repo, path: filePath, ref: branch });
      const response = await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as FileResult;
      if (!json.ok) throw new Error(json.error || "Unable to pull selected file");
      setContent(json.content || "");
      setFileSha(json.sha || "");
      setRoute(json.frontendRoute || json.sourceTruth?.route || "/");
      setOpenedByTopPull(true);
      setStatus(`Pulled ${json.path || filePath}`);
      setProofLog((items) => [...items.slice(-12), `Pulled ${json.path || filePath}`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to pull selected file");
    } finally {
      setLoadingFile(false);
    }
  }

  async function pushFile() {
    if (!repo || !branch || !filePath || !fileSha) {
      setError("Pull a file before pushing.");
      return;
    }
    setPushing(true);
    setError("");
    try {
      const response = await fetch("/api/streams-builder/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ repo, path: filePath, branch, sha: fileSha, content, agent: "Agent 1", message: `Agent 1: update ${filePath}` }),
      });
      const json = await readJson(response);
      if (!json.ok) throw new Error(json.error || "Push failed");
      setStatus(`Pushed ${json.commitSha || "commit"} to ${branch}`);
      setProofLog((items) => [...items.slice(-12), `Push complete: ${json.commitSha || "commit"}`]);
      await pullFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  useEffect(() => {
    const stored = readStoredActiveFile();
    if (stored?.path) openPulledFile(stored);
    void loadRepos();
  }, []);

  useEffect(() => {
    if (repo && branch && !openedByTopPull) void loadTree(repo, branch);
  }, [repo, branch, openedByTopPull]);

  useEffect(() => {
    function onPulledFile(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (!detail?.path) return;
      openPulledFile(detail);
    }
    window.addEventListener("streams-builder:pulled-file", onPulledFile);
    return () => window.removeEventListener("streams-builder:pulled-file", onPulledFile);
  }, []);

  return (
    <section className="agentOneWorkstation" aria-label="Agent 1 workstation">
      <div className="repoControls" aria-label="Agent 1 GitHub controls">
        <b>Agent 1</b>
        <select value="Visual Editing" aria-label="Workspace mode" onChange={() => undefined}><option>Visual Editing</option></select>
        <select value={repo} aria-label="Repository" onChange={(event) => { const nextRepo = event.target.value; const selected = repos.find((item) => item.fullName === nextRepo); setRepo(nextRepo); setBranch(selected?.defaultBranch || "main"); setOpenedByTopPull(false); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select>
        <input value={branch} aria-label="Branch" onChange={(event) => setBranch(event.target.value)} placeholder="branch" />
        <select value={directory} aria-label="Folder" onChange={(event) => { const nextDirectory = event.target.value; setDirectory(nextDirectory); const first = files.find((item) => item.directory === nextDirectory); setFilePath(first?.path || ""); setOpenedByTopPull(false); }}><option value="">folder</option>{directories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={filePath} aria-label="File" onChange={(event) => { setFilePath(event.target.value); setOpenedByTopPull(false); }}><option value="">file</option>{visibleFiles.map((item) => <option key={item.path} value={item.path}>{item.path}</option>)}</select>
        <button type="button" onClick={() => void loadRepos()} disabled={loadingRepos}>Repos</button>
        <button type="button" onClick={() => void loadTree()} disabled={loadingTree || !repo || !branch}>Tree</button>
        <button type="button" onClick={pullFile} disabled={loadingFile || !repo || !branch || !filePath}>{loadingFile ? "Pulling" : "Pull"}</button>
        <button type="button" onClick={pushFile} disabled={pushing || !fileSha}>{pushing ? "Pushing" : "Push"}</button>
      </div>

      {(error || status) ? <div className={error ? "repoError" : "repoStatus"}>{error || status}</div> : null}

      <div className="visualMount">
        {openedByTopPull ? (
          <section className="pulledWorkspace">
            <div className="frontendPreview">
              <iframe title={`Frontend preview for ${filePath}`} src={previewRoute} />
            </div>
            <textarea className="pulledFileEditor" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
          </section>
        ) : (
          <VisualEditingWorkstation stationLabel="Agent 1" route={route} filePath={filePath} repo={repo} branch={branch} content={content} onContentChange={setContent} onProof={(message) => setProofLog((items) => [...items.slice(-12), message])} onChat={(message) => setChatLog((items) => [...items.slice(-8), message])} />
        )}
      </div>

      <style jsx>{`
        .agentOneWorkstation{min-width:0;min-height:0;height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;background:#020617;}
        .repoControls{min-width:0;display:grid;grid-template-columns:.36fr .9fr 1.5fr .54fr 1fr 1.45fr auto auto auto auto;gap:5px;align-items:center;padding:5px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.94);box-sizing:border-box;}
        b{min-width:0;color:#fff;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}select,input{min-width:0;width:100%;height:24px;border:1px solid rgba(148,163,184,.14);border-radius:6px;background:#020617;color:#fff;padding:4px;font-size:7px;box-sizing:border-box;}option{color:#020617;}button{height:24px;border:1px solid rgba(148,163,184,.18);border-radius:6px;background:#7c3aed;color:#fff;padding:4px 6px;font-size:7px;font-weight:900;cursor:pointer;white-space:nowrap;}button:disabled{opacity:.45;cursor:not-allowed;}.repoError,.repoStatus{max-height:22px;overflow:hidden;padding:3px 6px;font-size:7px;border-bottom:1px solid rgba(148,163,184,.12);}.repoError{color:#fecaca;background:rgba(127,29,29,.24);}.repoStatus{color:#6ee7b7;background:rgba(6,78,59,.12);}.visualMount{min-width:0;min-height:0;overflow:hidden;}.pulledWorkspace{height:100%;min-height:0;display:grid;grid-template-rows:minmax(46%,56vh) minmax(260px,1fr);overflow:auto;background:#020617;}.frontendPreview{min-width:0;min-height:0;border-bottom:1px solid rgba(148,163,184,.18);background:#fff;overflow:auto;}.frontendPreview iframe{display:block;width:1366px;min-width:1366px;height:100%;min-height:100%;border:0;background:#fff;}.pulledFileEditor{width:100%;height:100%;min-width:0;min-height:260px;border:0;background:#020617;color:#e5e7eb;padding:14px;font-size:12px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;resize:none;outline:none;box-sizing:border-box;}
      `}</style>
    </section>
  );
}
