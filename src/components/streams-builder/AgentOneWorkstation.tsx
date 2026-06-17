"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAgentOneRepairPlan,
  verifyAgentOneWorkspaceState,
  type AgentOneRepairAction,
  type AgentOneWorkspaceState,
} from "./agent-one-state-controller";
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

function routeFromFile(path: string) {
  if (!path.startsWith("src/app/")) return "/";
  if (!path.endsWith("/page.tsx") && !path.endsWith("/page.jsx")) return "/";
  const route = path
    .replace(/^src\/app/, "")
    .replace(/\/page\.(tsx|jsx)$/, "")
    .replace(/\/\([^)]*\)/g, "");
  return route || "/";
}

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
  const [activeWorkFile, setActiveWorkFile] = useState("");
  const [openedFile, setOpenedFile] = useState("");
  const [writeTarget, setWriteTarget] = useState("");
  const [lastPulledSha, setLastPulledSha] = useState("");
  const [previewLoaded, setPreviewLoaded] = useState<boolean | undefined>(undefined);
  const [buildOk, setBuildOk] = useState<boolean | undefined>(undefined);
  const [previewNonce, setPreviewNonce] = useState(0);

  const visibleFiles = useMemo(() => directory ? files.filter((item) => item.directory === directory) : files, [directory, files]);
  const selectedRoute = routeFromFile(filePath);
  const previewRoute = route || selectedRoute || "/";
  const previewSrc = `${previewRoute}${previewRoute.includes("?") ? "&" : "?"}agent1Preview=${previewNonce}`;

  const agentState = useMemo<AgentOneWorkspaceState>(() => ({
    selectedRepo: repo,
    selectedBranch: branch,
    selectedFile: filePath,
    selectedRoute,
    activeWorkFile: activeWorkFile || (openedByTopPull ? filePath : ""),
    activeRoute: route,
    activePreview: previewRoute,
    activeCode: content,
    activeProof: proofLog.join("\n"),
    activeSha: fileSha,
    openedFile: openedFile || (openedByTopPull ? filePath : ""),
    writeTarget: writeTarget || (openedByTopPull ? filePath : ""),
    componentFile: activeWorkFile || (openedByTopPull ? filePath : ""),
    buildOk,
    previewLoaded,
    previewHardCoded: false,
    lastPulledSha,
  }), [repo, branch, filePath, selectedRoute, activeWorkFile, openedByTopPull, route, previewRoute, content, proofLog, fileSha, openedFile, writeTarget, buildOk, previewLoaded, lastPulledSha]);

  const verification = useMemo(() => verifyAgentOneWorkspaceState(agentState), [agentState]);
  const repairPlan = useMemo(() => getAgentOneRepairPlan(agentState), [agentState]);

  function addProof(message: string) {
    setProofLog((items) => [...items.slice(-16), `${nowStamp()} ${message}`]);
  }

  function blockWithVerification(prefix = "Blocked") {
    const next = verifyAgentOneWorkspaceState(agentState);
    setStatus(next.status);
    setError(`${prefix}: ${next.proof[0] || "Agent 1 source verification failed."}`);
    setProofLog((items) => [...items.slice(-16), ...next.proof.slice(0, 6).map((item) => `${nowStamp()} ${item}`)]);
    return next;
  }

  function syncActiveSource(detail: PulledFileDetail) {
    const nextRoute = detail.route || routeFromFile(detail.path);
    setRepo(detail.repo);
    setBranch(detail.branch || "main");
    setDirectory(detail.folder || "");
    setFilePath(detail.path);
    setFileSha(detail.sha || "");
    setContent(detail.content || "");
    setRoute(nextRoute);
    setActiveWorkFile(detail.path);
    setOpenedFile(detail.path);
    setWriteTarget(detail.path);
    setLastPulledSha(detail.sha || "");
    setPreviewLoaded(undefined);
    setBuildOk(undefined);
    setOpenedByTopPull(true);
    setError("");
    setStatus("Running");
    addProof(`Source truth pulled: ${detail.repo}@${detail.branch}:${detail.path}`);
  }

  function openPulledFile(detail: PulledFileDetail) {
    syncActiveSource(detail);
    setStatus("Verified");
    addProof(`Workspace rebuilt from top Pull: activeWorkFile=${detail.path}`);
  }

  async function loadRepos() {
    setLoadingRepos(true);
    setError("");
    setStatus("Running");
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
      setStatus("Ready");
      addProof(`Repo source list loaded: ${nextRepos.length} repos`);
    } catch (err) {
      setStatus("Blocked");
      setError(err instanceof Error ? err.message : "Unable to load GitHub repositories");
    } finally {
      setLoadingRepos(false);
    }
  }

  async function loadTree(nextRepo = repo, nextBranch = branch) {
    if (!nextRepo || !nextBranch) return;
    setLoadingTree(true);
    setError("");
    setStatus("Running");
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
          setRoute(routeFromFile(preferred.path || ""));
          setFileSha("");
          setActiveWorkFile("");
          setOpenedFile("");
          setWriteTarget("");
          setLastPulledSha("");
        }
      }
      setStatus(openedByTopPull ? "Verified" : "Ready");
      addProof(`Repository tree loaded from ${nextRepo}@${nextBranch}: ${nextFiles.length} files`);
    } catch (err) {
      setStatus("Blocked");
      setError(err instanceof Error ? err.message : "Unable to load repository files");
    } finally {
      setLoadingTree(false);
    }
  }

  async function pullFile() {
    if (!repo || !branch || !filePath) {
      setStatus("Blocked");
      setError("Select repo, branch, and file first.");
      return;
    }
    setLoadingFile(true);
    setError("");
    setStatus("Running");
    try {
      const params = new URLSearchParams({ repo, path: filePath, ref: branch });
      const response = await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as FileResult;
      if (!json.ok) throw new Error(json.error || "Unable to pull selected file");
      const pulledPath = json.path || filePath;
      const pulledRoute = json.frontendRoute || json.sourceTruth?.route || routeFromFile(pulledPath);
      syncActiveSource({ repo, branch, path: pulledPath, folder: pulledPath.split("/").slice(0, -1).join("/"), sha: json.sha || "", content: json.content || "", route: pulledRoute });
      setStatus("Verified");
      addProof(`Verified pull: selected file, activeWorkFile, opened file, and write target set to ${pulledPath}`);
    } catch (err) {
      setStatus("Blocked");
      setError(err instanceof Error ? err.message : "Unable to pull selected file");
    } finally {
      setLoadingFile(false);
    }
  }

  function reMapRoute() {
    const nextRoute = routeFromFile(filePath);
    setRoute(nextRoute);
    setPreviewLoaded(undefined);
    setStatus("Repairing");
    addProof(`Repair: re-mapped route from selected file ${filePath} -> ${nextRoute}`);
  }

  function refreshPreview() {
    setPreviewLoaded(undefined);
    setPreviewNonce((value) => value + 1);
    setStatus("Repairing");
    addProof(`Repair: refreshed preview for activeRoute=${previewRoute}`);
  }

  function restoreActiveFileFromMemory() {
    const stored = readStoredActiveFile();
    setStatus("Repairing");
    if (stored?.path) {
      syncActiveSource(stored);
      addProof(`Repair: restored active file from memory ${stored.path}`);
      return;
    }
    setActiveWorkFile(filePath);
    setOpenedFile(filePath);
    setWriteTarget(filePath);
    setRoute(routeFromFile(filePath));
    addProof(`Repair: no memory file found, restored active file to selected top-row file ${filePath}`);
  }

  async function runRepair(action: AgentOneRepairAction) {
    setError("");
    setStatus("Repairing");
    if (action === "reload-tree") await loadTree();
    if (action === "re-pull-file") await pullFile();
    if (action === "re-map-route") reMapRoute();
    if (action === "refresh-preview") refreshPreview();
    if (action === "restore-active-file-from-memory") restoreActiveFileFromMemory();
    if (action === "block-push") blockWithVerification("Push blocked");
  }

  async function runFullRepair() {
    setStatus("Repairing");
    setError("");
    await loadTree(repo, branch);
    await pullFile();
    reMapRoute();
    refreshPreview();
    const next = verifyAgentOneWorkspaceState({ ...agentState, activeWorkFile: filePath, openedFile: filePath, writeTarget: filePath, activeSha: fileSha, lastPulledSha: fileSha, activeRoute: routeFromFile(filePath), activePreview: routeFromFile(filePath), previewLoaded: undefined });
    setStatus(next.canPush ? "Verified" : "Blocked");
    addProof(next.canPush ? "Self-repair loop completed and verification passed." : `Self-repair loop completed with blocker: ${next.proof[0] || "unknown"}`);
  }

  function verifyNow() {
    const next = verifyAgentOneWorkspaceState(agentState);
    setStatus(next.status);
    setError(next.canPush ? "" : next.proof[0] || "Agent 1 blocked by source verification.");
    setProofLog((items) => [...items.slice(-16), ...next.proof.slice(0, 8).map((item) => `${nowStamp()} ${item}`)]);
  }

  async function pushFile() {
    const next = verifyAgentOneWorkspaceState(agentState);
    if (!next.canPush) {
      blockWithVerification("Push blocked");
      return;
    }
    setPushing(true);
    setError("");
    setStatus("Running");
    try {
      const response = await fetch("/api/streams-builder/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ repo, path: writeTarget, branch, sha: fileSha, content, agent: "Agent 1", message: `Agent 1 verified update: ${writeTarget}` }),
      });
      const json = await readJson(response);
      if (!json.ok) throw new Error(json.error || "Push failed");
      setStatus("Verified");
      addProof(`Push complete after source verification: ${json.commitSha || "commit"}`);
      await pullFile();
    } catch (err) {
      setStatus("Blocked");
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
        <select value="Source-backed Agent" aria-label="Workspace mode" onChange={() => undefined}><option>Source-backed Agent</option></select>
        <select value={repo} aria-label="Repository" onChange={(event) => { const nextRepo = event.target.value; const selected = repos.find((item) => item.fullName === nextRepo); setRepo(nextRepo); setBranch(selected?.defaultBranch || "main"); setOpenedByTopPull(false); setFileSha(""); setActiveWorkFile(""); setOpenedFile(""); setWriteTarget(""); }}><option value="">repo</option>{repos.map((item) => <option key={item.id} value={item.fullName}>{item.fullName}</option>)}</select>
        <input value={branch} aria-label="Branch" onChange={(event) => { setBranch(event.target.value); setFileSha(""); setOpenedByTopPull(false); }} placeholder="branch" />
        <select value={directory} aria-label="Folder" onChange={(event) => { const nextDirectory = event.target.value; setDirectory(nextDirectory); const first = files.find((item) => item.directory === nextDirectory); setFilePath(first?.path || ""); setRoute(routeFromFile(first?.path || "")); setOpenedByTopPull(false); setFileSha(""); setActiveWorkFile(""); setOpenedFile(""); setWriteTarget(""); }}><option value="">folder</option>{directories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={filePath} aria-label="File" onChange={(event) => { const nextFile = event.target.value; setFilePath(nextFile); setRoute(routeFromFile(nextFile)); setOpenedByTopPull(false); setFileSha(""); setActiveWorkFile(""); setOpenedFile(""); setWriteTarget(""); setLastPulledSha(""); }}><option value="">file</option>{visibleFiles.map((item) => <option key={item.path} value={item.path}>{item.path}</option>)}</select>
        <button type="button" onClick={() => void loadRepos()} disabled={loadingRepos}>Repos</button>
        <button type="button" onClick={() => void loadTree()} disabled={loadingTree || !repo || !branch}>Tree</button>
        <button type="button" onClick={pullFile} disabled={loadingFile || !repo || !branch || !filePath}>{loadingFile ? "Pulling" : "Pull"}</button>
        <button type="button" onClick={verifyNow}>Verify</button>
        <button type="button" onClick={pushFile} disabled={pushing || !verification.canPush}>{pushing ? "Pushing" : "Push"}</button>
      </div>

      <div className={error ? "repoError" : "repoStatus"}>{error || `${status} · Agent 1 source-backed verification ${verification.canPush ? "passed" : "requires repair"}`}</div>

      <div className="agentTruthPanel" aria-label="Agent 1 source truth and repair panel">
        <div><b>Agent 1 Active</b><span>{verification.status}</span></div>
        <div><b>Knowledge</b><span>Repo + route + file + build + browser</span></div>
        <div><b>Selected File</b><span>{filePath || "none"}</span></div>
        <div><b>Active File</b><span>{activeWorkFile || "not pulled"}</span></div>
        <div><b>Route</b><span>{previewRoute}</span></div>
        <div><b>SHA</b><span>{fileSha || "missing"}</span></div>
        <div className="repairActions"><b>Repair</b><span>{repairPlan.length ? repairPlan.join(" / ") : "No repair needed"}</span></div>
        <button type="button" onClick={() => void runFullRepair()}>Repair + Test</button>
        <button type="button" onClick={() => void runRepair("re-pull-file")}>Re-pull</button>
        <button type="button" onClick={() => void runRepair("re-map-route")}>Re-map Route</button>
        <button type="button" onClick={() => void runRepair("refresh-preview")}>Refresh Preview</button>
      </div>

      <div className="visualMount">
        {openedByTopPull ? (
          <section className="pulledWorkspace">
            <div className="frontendPreview">
              <iframe title={`Frontend preview for ${filePath}`} src={previewSrc} onLoad={() => { setPreviewLoaded(true); addProof(`Iframe loaded active preview route: ${previewRoute}`); }} />
            </div>
            <textarea className="pulledFileEditor" value={content} onChange={(event) => { setContent(event.target.value); setBuildOk(undefined); }} spellCheck={false} />
          </section>
        ) : (
          <VisualEditingWorkstation stationLabel="Agent 1" route={route} filePath={filePath} repo={repo} branch={branch} content={content} onContentChange={(value) => { setContent(value); setBuildOk(undefined); }} onProof={(message) => addProof(message)} onChat={(message) => setChatLog((items) => [...items.slice(-8), message])} />
        )}
      </div>

      <div className="proofStrip" aria-label="Agent 1 proof and repair log">
        {(proofLog.length ? proofLog : verification.proof).slice(-6).map((item) => <span key={item}>{item}</span>)}
        {chatLog.slice(-2).map((item) => <span key={item}>Chat: {item}</span>)}
      </div>

      <style jsx>{`
        .agentOneWorkstation{min-width:0;min-height:0;height:100%;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:hidden;background:#020617;}
        .repoControls{min-width:0;display:grid;grid-template-columns:.36fr .9fr 1.5fr .54fr 1fr 1.45fr auto auto auto auto auto;gap:5px;align-items:center;padding:5px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.94);box-sizing:border-box;}
        b{min-width:0;color:#fff;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}select,input{min-width:0;width:100%;height:24px;border:1px solid rgba(148,163,184,.14);border-radius:6px;background:#020617;color:#fff;padding:4px;font-size:7px;box-sizing:border-box;}option{color:#020617;}button{height:24px;border:1px solid rgba(148,163,184,.18);border-radius:6px;background:#7c3aed;color:#fff;padding:4px 6px;font-size:7px;font-weight:900;cursor:pointer;white-space:nowrap;}button:disabled{opacity:.45;cursor:not-allowed;background:#334155;}.repoError,.repoStatus{max-height:22px;overflow:hidden;padding:3px 6px;font-size:7px;border-bottom:1px solid rgba(148,163,184,.12);}.repoError{color:#fecaca;background:rgba(127,29,29,.24);}.repoStatus{color:#6ee7b7;background:rgba(6,78,59,.12);}.agentTruthPanel{min-width:0;display:grid;grid-template-columns:.58fr 1.15fr 1.4fr 1.4fr .6fr .7fr 1.4fr auto auto auto auto;gap:5px;align-items:center;padding:5px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.86);}.agentTruthPanel div{min-width:0;border:1px solid rgba(148,163,184,.12);border-radius:8px;padding:4px 6px;background:rgba(15,23,42,.7);}.agentTruthPanel span{display:block;min-width:0;color:#cbd5e1;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.repairActions span{color:#fde68a;}.visualMount{min-width:0;min-height:0;overflow:hidden;}.pulledWorkspace{height:100%;min-height:0;display:grid;grid-template-rows:minmax(46%,56vh) minmax(260px,1fr);overflow:auto;background:#020617;}.frontendPreview{min-width:0;min-height:0;border-bottom:1px solid rgba(148,163,184,.18);background:#fff;overflow:auto;}.frontendPreview iframe{display:block;width:1366px;min-width:1366px;height:100%;min-height:100%;border:0;background:#fff;}.pulledFileEditor{width:100%;height:100%;min-width:0;min-height:260px;border:0;background:#020617;color:#e5e7eb;padding:14px;font-size:12px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;resize:none;outline:none;box-sizing:border-box;}.proofStrip{min-width:0;display:flex;gap:5px;overflow:auto;border-top:1px solid rgba(148,163,184,.12);padding:5px;background:rgba(2,6,23,.92);}.proofStrip span{flex:0 0 auto;max-width:360px;border:1px solid rgba(148,163,184,.12);border-radius:999px;padding:4px 8px;color:#cbd5e1;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(15,23,42,.82);}
      `}</style>
    </section>
  );
}
