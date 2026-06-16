"use client";

import { useEffect, useMemo, useState } from "react";
import VisualEditingWorkstation from "./VisualEditingWorkstation";

type Repo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
  updatedAt: string;
};

type TreeFile = {
  path: string;
  sha: string;
  size: number;
  directory: string;
  name: string;
};

type TreeResponse = {
  ok: boolean;
  error?: string;
  files?: TreeFile[];
  directories?: string[];
  truncated?: boolean;
};

type FileResult = {
  ok: boolean;
  error?: string;
  repo?: string;
  path?: string;
  ref?: string;
  sha?: string;
  frontendRoute?: string;
  content?: string;
  sourceTruth?: {
    route: string;
    component: string;
    file: string;
    githubPath: string;
    branch: string;
    writeTarget: string;
    mode: string;
    branchWrites: string;
  };
};

type WorkspaceMode =
  | "Primary Builder"
  | "Visual Editing"
  | "Component Mapping"
  | "Approval Center"
  | "Browser Verification"
  | "Repository Truth"
  | "Projects Dashboard"
  | "Truth Panel";

const WORKSPACE_MODES: WorkspaceMode[] = [
  "Primary Builder",
  "Visual Editing",
  "Component Mapping",
  "Approval Center",
  "Browser Verification",
  "Repository Truth",
  "Projects Dashboard",
  "Truth Panel",
];

const STATIONS = ["Agent 1", "Agent 2", "Agent 3", "Agent 4"];

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`);
  }
}

function inferMode(path: string): WorkspaceMode {
  const value = path.toLowerCase();
  if (value.includes("visual") || value.includes("editor")) return "Visual Editing";
  if (value.includes("component")) return "Component Mapping";
  if (value.includes("approval")) return "Approval Center";
  if (value.includes("browser") || value.includes("test")) return "Browser Verification";
  if (value.includes("repo") || value.includes("git")) return "Repository Truth";
  if (value.includes("dashboard") || value.includes("project")) return "Projects Dashboard";
  if (value.includes("truth")) return "Truth Panel";
  return "Primary Builder";
}

function defaultPromptForMode(mode: WorkspaceMode) {
  switch (mode) {
    case "Visual Editing":
      return "Click frontend elements, edit safely, verify browser/mobile, and save patch only after source truth.";
    case "Component Mapping":
      return "Map route, component, parent/children, file, imports, exports, and GitHub path.";
    case "Approval Center":
      return "Review proof, approve, reject, request changes, or rollback.";
    case "Browser Verification":
      return "Click, scroll, type, verify console, desktop, and mobile like a user.";
    case "Repository Truth":
      return "Check branch, diff, file ownership, changed files, and push readiness.";
    case "Projects Dashboard":
      return "Show project status, deployments, versions, and build activity.";
    case "Truth Panel":
      return "Classify Proven, Unproven, Failed, and Unknown using evidence only.";
    default:
      return "Build, validate, save, rollback, and approve only inside this station.";
  }
}

export default function GitHubRepositoryPicker() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [error, setError] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);

  async function loadRepos() {
    setLoadingRepos(true);
    setError("");
    try {
      const response = await fetch("/api/streams-builder/github/repos", { cache: "no-store" });
      const json = await readJson(response);
      if (!json.ok) throw new Error(json.error || "Unable to load GitHub repositories");
      setRepos(json.repos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load GitHub repositories");
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    void loadRepos();
  }, []);

  return (
    <section className="stationSystem">
      <header className="topBar">
        <div>
          <p>STREAMS BUILDER WORKSTATIONS</p>
          <h1>4 Equal Workstations · Editor · Browser · Mobile · Advanced · Proof</h1>
        </div>
        <button type="button" onClick={loadRepos} disabled={loadingRepos}>
          {loadingRepos ? "Loading" : "Reload Repos"}
        </button>
      </header>

      {error ? <div className="tokenWarning">{error}</div> : null}

      <div className="stationGrid">
        {STATIONS.map((label, index) => (
          <Workstation key={label} label={label} index={index} repos={repos} />
        ))}
      </div>

      <style jsx>{`
        .stationSystem {
          width: 100%;
          min-height: 100%;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 8px;
          overflow: auto;
          box-sizing: border-box;
        }
        .topBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 44px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.72);
          padding: 8px 10px;
        }
        .topBar p {
          margin: 0;
          color: #6ee7b7;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .topBar h1 {
          margin: 2px 0 0;
          color: #fff;
          font-size: 16px;
        }
        .topBar button {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: #7c3aed;
          color: #fff;
          padding: 7px 10px;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }
        .topBar button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .tokenWarning {
          border: 1px solid rgba(248, 113, 113, 0.35);
          border-radius: 10px;
          background: rgba(127, 29, 29, 0.24);
          color: #fecaca;
          padding: 8px 10px;
          font-size: 10px;
        }
        .stationGrid {
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-auto-rows: minmax(610px, 78vh);
          gap: 10px;
          overflow: visible;
        }
        @media (max-width: 1200px) {
          .stationGrid {
            grid-template-columns: 1fr;
            grid-auto-rows: minmax(650px, 88vh);
          }
        }
      `}</style>
    </section>
  );
}

function Workstation({ label, index, repos }: { label: string; index: number; repos: Repo[] }) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("Visual Editing");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [directory, setDirectory] = useState("");
  const [filePath, setFilePath] = useState("");
  const [file, setFile] = useState<FileResult | null>(null);
  const [routeInput, setRouteInput] = useState("/");
  const [frameKey, setFrameKey] = useState(0);
  const [promptInput, setPromptInput] = useState(defaultPromptForMode("Visual Editing"));
  const [chatMessages, setChatMessages] = useState<string[]>([
    `${label} ready. Every station has Editor, Browser, Mobile, Advanced, Save, Dup, Reset.`,
  ]);
  const [proofLog, setProofLog] = useState<string[]>([
    "Waiting for source truth, browser proof, changed-file audit, and user approval.",
  ]);
  const [content, setContent] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const selectedRepo = useMemo(
    () => repos.find((item) => item.fullName === repo) || null,
    [repos, repo],
  );

  const visibleFiles = useMemo(() => {
    if (!directory) return files;
    return files.filter((item) => item.directory === directory);
  }, [files, directory]);

  const activeRoute = file?.frontendRoute || routeInput || "/";

  useEffect(() => {
    if (!repo && repos[index]) {
      setRepo(repos[index].fullName);
      setBranch(repos[index].defaultBranch || "main");
    } else if (!repo && repos[0]) {
      setRepo(repos[0].fullName);
      setBranch(repos[0].defaultBranch || "main");
    }
  }, [repos, index, repo]);

  useEffect(() => {
    if (repo && branch) {
      void loadTree(repo, branch);
    }
  }, [repo, branch]);

  function addChat(message: string) {
    setChatMessages((items) => [...items.slice(-5), message]);
  }

  function addProof(message: string) {
    setProofLog((items) => [...items.slice(-8), `${new Date().toLocaleTimeString()} ${message}`]);
  }

  async function loadTree(nextRepo = repo, nextBranch = branch) {
    if (!nextRepo) return;
    setLoadingTree(true);
    setError("");
    setStatus("");
    setFiles([]);
    setDirectories([]);
    setDirectory("");
    setFilePath("");
    setFile(null);
    setContent("");
    addProof(`Loading tree for ${nextRepo}@${nextBranch}.`);

    try {
      const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch || "main" });
      const response = await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as TreeResponse;
      if (!json.ok) throw new Error(json.error || "Unable to load repository files");

      const nextFiles = json.files || [];
      const nextDirectories = json.directories || [];
      setFiles(nextFiles);
      setDirectories(nextDirectories);

      const preferred =
        nextFiles.find((item) => item.path.includes("src/app") && item.path.endsWith("page.tsx")) ||
        nextFiles.find((item) => item.path.includes("streams-builder")) ||
        nextFiles.find((item) => item.path.includes("components")) ||
        nextFiles[0];

      if (preferred) {
        setDirectory(preferred.directory);
        setFilePath(preferred.path);
      }
      addProof(`Tree loaded: ${nextFiles.length} files available.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load repository files";
      setError(message);
      addProof(`Tree failed: ${message}`);
    } finally {
      setLoadingTree(false);
    }
  }

  async function pullFile() {
    if (!repo || !filePath) {
      setError("Select repo and file first.");
      return;
    }
    setLoadingFile(true);
    setError("");
    setStatus("");
    addProof(`Pull started for ${repo}/${filePath}.`);

    try {
      const params = new URLSearchParams({
        repo,
        path: filePath,
        ref: branch || selectedRepo?.defaultBranch || "main",
      });
      const response = await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as FileResult;
      if (!json.ok) throw new Error(json.error || "Unable to pull selected file");

      setFile(json);
      setContent(json.content || "");
      setRouteInput(json.frontendRoute || "/");
      setWorkspaceMode(inferMode(json.path || filePath));
      setStatus("Pulled into isolated station workspace.");
      addChat(`Pulled ${json.path || filePath}.`);
      addProof(`Source Truth: ${json.sourceTruth?.route || "/"} -> ${json.sourceTruth?.file || filePath}`);
      setFrameKey((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to pull selected file";
      setError(message);
      addProof(`Pull failed: ${message}`);
    } finally {
      setLoadingFile(false);
    }
  }

  async function pushFile() {
    if (!repo || !filePath || !file?.sha) {
      setError("Pull a file before pushing.");
      return;
    }
    setPushing(true);
    setError("");
    setStatus("");
    addProof(`Push started for ${repo}/${filePath}.`);

    try {
      const response = await fetch("/api/streams-builder/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          repo,
          path: filePath,
          branch: branch || selectedRepo?.defaultBranch || "main",
          sha: file.sha,
          content,
          agent: label,
          message: `${label}: ${promptInput || `update ${filePath}`}`,
        }),
      });
      const json = await readJson(response);
      if (!json.ok) throw new Error(json.error || "Push failed");

      setStatus(`Pushed ${json.commitSha || "commit"} to ${branch}.`);
      addChat(`Pushed update to ${branch}.`);
      addProof(`Push complete: ${json.commitSha || "commit"}.`);
      await pullFile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Push failed";
      setError(message);
      addProof(`Push failed: ${message}`);
    } finally {
      setPushing(false);
    }
  }

  function submitPrompt() {
    if (!promptInput.trim()) return;
    addChat(promptInput.trim());
    addProof(`${workspaceMode} prompt queued for selected file only.`);
    setPromptInput("");
  }

  const station = (
    <article className="station">
      <div className="stationControls">
        <b>{label}</b>
        <select
          value={workspaceMode}
          onChange={(event) => {
            const next = event.target.value as WorkspaceMode;
            setWorkspaceMode(next);
            setPromptInput(defaultPromptForMode(next));
            addProof(`Workspace mode changed to ${next}.`);
          }}
        >
          {WORKSPACE_MODES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          value={repo}
          onChange={(event) => {
            const nextRepo = event.target.value;
            const selected = repos.find((item) => item.fullName === nextRepo);
            setRepo(nextRepo);
            setBranch(selected?.defaultBranch || "main");
          }}
        >
          <option value="">repo</option>
          {repos.map((item) => (
            <option key={item.id} value={item.fullName}>{item.fullName}</option>
          ))}
        </select>
        <input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch" />
        <select
          value={directory}
          onChange={(event) => {
            const nextDirectory = event.target.value;
            setDirectory(nextDirectory);
            const first = files.find((item) => item.directory === nextDirectory);
            setFilePath(first?.path || "");
          }}
        >
          <option value="">folder</option>
          {directories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={filePath} onChange={(event) => setFilePath(event.target.value)}>
          <option value="">file</option>
          {visibleFiles.map((item) => (
            <option key={item.path} value={item.path}>{item.path}</option>
          ))}
        </select>
        <button type="button" onClick={pullFile} disabled={loadingFile || !repo || !filePath}>
          {loadingFile ? "Pulling" : "Pull"}
        </button>
        <button type="button" onClick={pushFile} disabled={pushing || !file?.sha}>
          {pushing ? "Pushing" : "Push"}
        </button>
        <button type="button" onClick={() => setFullscreen(true)}>Full</button>
      </div>

      <div className="browser">
        <div className="browserViewport">
          {file ? (
            <textarea
              className="workspaceFileEditor"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck={false}
            />
          ) : workspaceMode === "Visual Editing" ? (
            <VisualEditingWorkstation
              stationLabel={label}
              route={activeRoute}
              filePath={filePath || ""}
              repo={repo}
              branch={branch}
              content={content}
              onContentChange={setContent}
              onProof={addProof}
              onChat={addChat}
            />
          ) : routeInput !== "/" ? (
            <iframe key={frameKey} title={`${label} browser`} src={activeRoute} />
          ) : (
            <MockLanding label={label} />
          )}
        </div>
      </div>

      <details className="stationSettings">
        <summary>Proof / Source Truth / Editor</summary>
        <div className="truth">
          <div><span>Repo</span><b>{repo || "none"}</b></div>
          <div><span>Branch</span><b>{branch || "none"}</b></div>
          <div><span>Mode</span><b>{workspaceMode}</b></div>
          <div><span>File</span><b>{filePath || "none"}</b></div>
          <div><span>Route</span><b>{file?.sourceTruth?.route || routeInput}</b></div>
          <div><span>Isolation</span><b>No crossing contexts</b></div>
        </div>
        <div className="logs">
          <section>
            <b>AI Chat</b>
            {chatMessages.map((item, idx) => <p key={`${item}-${idx}`}>{item}</p>)}
          </section>
          <section>
            <b>Proof Log</b>
            {proofLog.map((item, idx) => <p key={`${item}-${idx}`}>{item}</p>)}
          </section>
        </div>
        <textarea className="editor" value={content} onChange={(event) => setContent(event.target.value)} />
      </details>

      <div className="stationChat">
        <textarea
          value={promptInput}
          onChange={(event) => setPromptInput(event.target.value)}
          placeholder={`${label} AI prompt. This station only controls its selected repo/file.`}
        />
        <button type="button" onClick={submitPrompt}>Send</button>
      </div>

      {(error || status) ? <div className={error ? "error" : "status"}>{error || status}</div> : null}

      <style jsx>{`
        .station {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto auto auto;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.78);
          overflow: hidden;
        }
        .stationControls {
          min-width: 0;
          display: grid;
          grid-template-columns: 0.32fr 0.85fr 1fr 0.4fr 0.9fr 1fr auto auto auto;
          gap: 4px;
          align-items: center;
          padding: 4px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }
        .stationControls b {
          min-width: 0;
          color: #fff;
          font-size: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        select,
        input,
        textarea {
          min-width: 0;
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 6px;
          background: #020617;
          color: #fff;
          padding: 4px;
          height: 24px;
          font-size: 7px;
          box-sizing: border-box;
        }
        button {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 6px;
          background: #7c3aed;
          color: #fff;
          padding: 4px 6px;
          height: 24px;
          font-size: 7px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }
        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .browser {
          min-height: 0;
          height: 100%;
          margin: 4px;
          display: grid;
          grid-template-rows: minmax(0, 1fr);
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 9px;
          overflow: hidden;
          background: #020617;
        }
        .browserViewport {
          min-height: 0;
          height: 100%;
          overflow: hidden;
          background: #020617;
        }
        .workspaceFileEditor {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 100%;
          border: 0;
          border-radius: 0;
          background: #020617;
          color: #e5e7eb;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.55;
          padding: 14px;
          resize: none;
          outline: none;
          box-sizing: border-box;
        }
        iframe {
          border: 0;
          background: #fff;
          transform: scale(0.5);
          transform-origin: top left;
          width: 200%;
          height: 200%;
          min-height: 0;
        }
        .stationSettings {
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          padding: 3px 5px;
          font-size: 7px;
          min-height: 18px;
          max-height: 20px;
          overflow: hidden;
        }
        .stationSettings[open] {
          max-height: 260px;
          overflow: auto;
        }
        .stationSettings summary {
          cursor: pointer;
          color: #94a3b8;
          font-weight: 900;
        }
        .truth {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 5px;
          margin-top: 6px;
        }
        .truth div {
          min-width: 0;
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 7px;
          background: rgba(6, 78, 59, 0.14);
          padding: 5px;
        }
        .truth span {
          display: block;
          color: #6ee7b7;
          font-size: 6px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .truth b {
          display: block;
          color: #fff;
          font-size: 7px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .logs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-top: 6px;
        }
        .logs section {
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 7px;
          padding: 5px;
          background: rgba(2, 6, 23, 0.6);
        }
        .logs p {
          margin: 3px 0 0;
          color: #cbd5e1;
        }
        .editor {
          margin-top: 6px;
          height: 110px;
          resize: vertical;
        }
        .stationChat {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 42px;
          gap: 4px;
          padding: 0 4px 4px;
        }
        .stationChat textarea {
          height: 28px;
          resize: none;
        }
        .error,
        .status {
          margin: 0 4px 4px;
          border-radius: 6px;
          padding: 3px 5px;
          font-size: 7px;
          max-height: 22px;
          overflow: hidden;
        }
        .error {
          border: 1px solid rgba(248, 113, 113, 0.35);
          background: rgba(127, 29, 29, 0.24);
          color: #fecaca;
        }
        .status {
          border: 1px solid rgba(16, 185, 129, 0.25);
          background: rgba(6, 78, 59, 0.14);
          color: #6ee7b7;
        }
      `}</style>
    </article>
  );

  return fullscreen ? (
    <div className="fullscreen">
      {station}
      <button className="exitFull" type="button" onClick={() => setFullscreen(false)}>Exit Fullscreen</button>
      <style jsx>{`
        .fullscreen {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: #020713;
          padding: 10px;
          display: grid;
        }
        .exitFull {
          position: fixed;
          right: 18px;
          top: 18px;
          z-index: 1000;
        }
      `}</style>
    </div>
  ) : station;
}

function MockLanding({ label }: { label: string }) {
  return (
    <div className="mockLanding">
      <nav>
        <b>StreamsAI</b>
        <span>Features</span>
        <span>Pricing</span>
        <button type="button">Login</button>
      </nav>
      <section>
        <p>{label.toUpperCase()} LIVE BROWSER</p>
        <h1>Build Better.<br />Ship Faster.</h1>
        <span>Mock landing page shown until this station pulls a real frontend route.</span>
      </section>
      <div className="cards">
        <article>Hero</article>
        <article>CTA</article>
        <article>Proof</article>
      </div>
      <style jsx>{`
        .mockLanding {
          width: 100%;
          height: 100%;
          min-height: 100%;
          background:
            radial-gradient(circle at 75% 20%, rgba(124, 58, 237, 0.25), transparent 28%),
            linear-gradient(135deg, #020617, #0f172a);
          color: #fff;
          padding: 22px;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 18px;
          box-sizing: border-box;
          overflow: hidden;
        }
        nav {
          display: flex;
          align-items: center;
          gap: 22px;
          font-size: 13px;
        }
        nav b {
          font-size: 24px;
          margin-right: auto;
        }
        nav button {
          width: auto;
          height: auto;
          padding: 10px 18px;
          border-radius: 999px;
          font-size: 12px;
        }
        section {
          display: grid;
          place-items: center;
          text-align: center;
        }
        section p {
          color: #6ee7b7;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          margin: 0 0 12px;
        }
        h1 {
          font-size: 62px;
          line-height: 0.95;
          margin: 0 0 14px;
        }
        section span {
          color: #cbd5e1;
          font-size: 14px;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .cards article {
          min-height: 88px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.7);
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}
