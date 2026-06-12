"use client";

import { useEffect, useMemo, useState } from "react";

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

const labels = ["Agent 1", "Agent 2", "Agent 3", "Agent 4"];

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but received: ${text.slice(0, 90)}`);
  }
}

export default function GitHubRepositoryPicker() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadRepos() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/streams-builder/github/repos", { cache: "no-store" });
      const json = await readJson(response);

      if (!json.ok) throw new Error(json.error || "Unable to load GitHub repositories");

      setRepos(json.repos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load GitHub repositories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRepos();
  }, []);

  return (
    <section className="repo-system">
      <header className="system-head">
        <div>
          <p>GITHUB REPOSITORY INVENTORY</p>
          <h3>4 isolated AI workspaces. Each agent owns one repo/file context.</h3>
        </div>
        <button type="button" onClick={loadRepos}>{loading ? "Loading" : "Reload Repos"}</button>
      </header>

      {error ? <div className="global-error">{error}</div> : null}

      <div className="agent-grid">
        {labels.map((label, index) => (
          <RepoAgentCard key={label} label={label} index={index} repos={repos} />
        ))}
      </div>

      <style jsx>{`
        .repo-system {
          min-height: 0;
          height: 100%;
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 14px;
          background: rgba(2,6,23,.58);
          padding: 6px;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .system-head {
          display: none;
        }
        .system-head p {
          margin: 0;
          color: #6ee7b7;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .08em;
        }
        .system-head h3 {
          margin: 2px 0 0;
          color: #fff;
          font-size: 12px;
        }
        button {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 6px;
          background: #7c3aed;
          color: #fff;
          padding: 4px 7px;
          height: 24px;
          font-size: 7px;
          font-weight: 900;
          cursor: pointer;
        }
        button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }
        .global-error {
          margin-bottom: 6px;
          border: 1px solid rgba(248,113,113,.35);
          border-radius: 8px;
          background: rgba(127,29,29,.24);
          color: #fecaca;
          padding: 7px;
          font-size: 9px;
        }
        .agent-grid {
          min-height: 0;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(0, 1fr));
          gap: 10px;
          overflow: hidden;
        }
      `}</style>
    </section>
  );
}

function RepoAgentCard({
  label,
  index,
  repos,
}: {
  label: string;
  index: number;
  repos: Repo[];
}) {
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [directory, setDirectory] = useState("");
  const [filePath, setFilePath] = useState("");
  const [file, setFile] = useState<FileResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const selectedRepo = useMemo(() => repos.find((item) => item.fullName === repo) || null, [repos, repo]);

  const visibleFiles = useMemo(() => {
    if (!directory) return files;
    return files.filter((item) => item.directory === directory);
  }, [files, directory]);

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
    if (repo && branch) void loadTree(repo, branch);
  }, [repo, branch]);

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

    try {
      const params = new URLSearchParams({ repo: nextRepo, ref: nextBranch || "main" });
      const response = await fetch(`/api/streams-builder/github/tree?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as TreeResponse;

      if (!json.ok) throw new Error(json.error || "Unable to load repository files");

      const nextFiles = json.files || [];
      const nextDirs = json.directories || [];

      setFiles(nextFiles);
      setDirectories(nextDirs);

      const preferred =
        nextFiles.find((item) => item.path.includes("src/app") && item.path.endsWith("page.tsx")) ||
        nextFiles.find((item) => item.path.includes("streams-builder")) ||
        nextFiles.find((item) => item.path.includes("components")) ||
        nextFiles[0];

      if (preferred) {
        setDirectory(preferred.directory);
        setFilePath(preferred.path);
      }

      if (json.truncated) setError("GitHub returned a truncated tree.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load repository files");
    } finally {
      setLoadingTree(false);
    }
  }

  async function loadFile() {
    if (!repo || !filePath) {
      setError("Select repo and file first.");
      return;
    }

    setLoadingFile(true);
    setError("");
    setStatus("");

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
      setStatus("Pulled file into isolated station.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to pull selected file");
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
          message: `${label}: ${prompt || `update ${filePath}`}`,
        }),
      });

      const json = await readJson(response);

      if (!json.ok) throw new Error(json.error || "Push failed");

      setStatus(`Pushed ${json.commitSha || "commit"} to ${branch}.`);
      await loadFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  return (
    <article className="agent-card">
      <div className="station-controls">
        <b>{label}</b>

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
            <option key={item.id} value={item.fullName}>
              {item.fullName}
            </option>
          ))}
        </select>

        <input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch" />

        <select
          value={directory}
          onChange={(event) => {
            const next = event.target.value;
            setDirectory(next);
            const first = files.find((item) => item.directory === next);
            setFilePath(first?.path || "");
          }}
        >
          <option value="">folders</option>
          {directories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select value={filePath} onChange={(event) => setFilePath(event.target.value)}>
          <option value="">file</option>
          {visibleFiles.map((item) => (
            <option key={item.path} value={item.path}>
              {item.path}
            </option>
          ))}
        </select>

        <button type="button" onClick={loadFile} disabled={loadingFile || !repo || !filePath}>
          {loadingFile ? "Pulling" : "Pull"}
        </button>

        <button type="button" onClick={pushFile} disabled={pushing || !file?.sha}>
          {pushing ? "Pushing" : "Push"}
        </button>
      </div>

      <textarea
        className="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={`${label} prompt. This agent only controls its selected repo/file.`}
      />

      {error ? <div className="error">{error}</div> : null}
      {status ? <div className="status">{status}</div> : null}

      <div className="live">
        <div className="live-head">
          <b>{file?.sourceTruth?.route || "No route yet"}</b>
          <span>{file?.sourceTruth?.file || `${visibleFiles.length} files available`}</span>
        </div>
        {file?.frontendRoute ? (
          <iframe title={`${label} live frontend`} src={file.frontendRoute} />
        ) : (
          <div className="empty">Pull a file to show the full frontend page.</div>
        )}
      </div>

      <details className="settings">
        <summary>Settings / Source Truth</summary>
        <div className="truth">
          <div><span>Repo</span><b>{repo || "none"}</b></div>
          <div><span>Branch</span><b>{branch || "none"}</b></div>
          <div><span>File</span><b>{filePath || "none"}</b></div>
          <div><span>Route</span><b>{file?.sourceTruth?.route || "none"}</b></div>
          <div><span>Mode</span><b>{file?.sourceTruth?.mode || "not pulled"}</b></div>
          <div><span>Isolation</span><b>No crossing station contexts</b></div>
        </div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} />
      </details>

      <style jsx>{`
        .agent-card {
          min-width: 0;
          min-height: 0;
          height: 100%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 1px solid rgba(148,163,184,.16);
          border-radius: 12px;
          background: rgba(15,23,42,.78);
          overflow: hidden;
        }
        .station-controls {
          display: grid;
          grid-template-columns: .35fr 1.05fr .4fr .95fr 1fr auto auto;
          gap: 4px;
          align-items: center;
          padding: 4px;
          border-bottom: 1px solid rgba(148,163,184,.12);
        }
        .station-controls b {
          color: #fff;
          font-size: 8px;
          white-space: nowrap;
        }
        input, select, textarea {
          min-width: 0;
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 6px;
          background: #020617;
          color: #fff;
          padding: 4px;
          height: 24px;
          font-size: 7px;
        }
        button {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 6px;
          background: #7c3aed;
          color: #fff;
          padding: 4px 7px;
          height: 24px;
          font-size: 7px;
          font-weight: 900;
          cursor: pointer;
        }
        button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }
        .prompt {
          display: none;
        }
        .error, .status {
          margin: 3px 4px 0;
          border-radius: 6px;
          padding: 3px;
          font-size: 7px;
        }
        .error {
          border: 1px solid rgba(248,113,113,.35);
          background: rgba(127,29,29,.24);
          color: #fecaca;
        }
        .status {
          border: 1px solid rgba(16,185,129,.25);
          background: rgba(6,78,59,.14);
          color: #6ee7b7;
        }
        .live {
          min-height: 0;
          height: 100%;
          margin: 5px;
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 9px;
          background: #020617;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }
        .live-head {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          padding: 4px 7px;
          border-bottom: 1px solid rgba(148,163,184,.1);
          font-size: 7px;
          min-height: 20px;
        }
        .live-head span {
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        iframe {
          border: 0;
          background: #fff;
          transform: scale(0.42);
          transform-origin: top left;
          width: 238.1%;
          height: 238.1%;
          min-height: 0;
        }
        .empty {
          height: 100%;
          min-height: 0;
          display: grid;
          place-items: center;
          color: #64748b;
          font-size: 8px;
          text-align: center;
          padding: 8px;
        }
        .settings {
          border-top: 1px solid rgba(148,163,184,.12);
          padding: 3px 5px;
          font-size: 7px;
          min-height: 16px;
          max-height: 18px;
          overflow: hidden;
        }
        .settings summary {
          cursor: pointer;
          color: #94a3b8;
          font-weight: 900;
          line-height: 1;
        }
        .truth {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 5px;
          margin-top: 6px;
        }
        .truth div {
          min-width: 0;
          border: 1px solid rgba(16,185,129,.25);
          border-radius: 7px;
          background: rgba(6,78,59,.14);
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
        .settings textarea {
          margin-top: 6px;
          width: 100%;
          min-height: 140px;
          resize: vertical;
        }
      `}</style>
    </article>
  );
}


