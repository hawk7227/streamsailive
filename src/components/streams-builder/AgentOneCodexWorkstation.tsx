"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GitHubStyleCodeEditor from "./GitHubStyleCodeEditor";
import { verifyAgentOneWorkspaceState } from "./agent-one-state-controller";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type Surface = "summary" | "code" | "frontend" | "diff" | "logs" | "media";
type MediaKind = "image" | "video" | "audio" | "file";
type MediaOutput = { id?: string; kind?: MediaKind; title?: string; prompt?: string; url?: string; status?: string };
type HighlightRange = { filePath?: string; startLine: number; endLine?: number; label?: string } | null;
type RuntimeJobDetail = { jobId: string; repo?: string; branch?: string; path?: string; route?: string; prompt?: string };
type RuntimeEvent = { id?: string | number; eventType?: string; event_type?: string; message?: string | null; createdAt?: string; created_at?: string; data?: Record<string, unknown> };

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
  const route = path.replace(/^src\/app/, "").replace(/\/page\.(tsx|jsx)$/, "").replace(/\/\([^)]*\)/g, "");
  return route || "/";
}

function surfaceFromPrompt(prompt?: string): Surface {
  const value = (prompt || "").toLowerCase();
  if (/(image|video|movie|render|generate|media|voice|audio)/.test(value)) return "media";
  if (/(frontend|ui|preview|screen|visual)/.test(value)) return "frontend";
  if (/(diff|change|patch)/.test(value)) return "diff";
  if (/(log|error|console|test|build)/.test(value)) return "logs";
  if (/(code|file|tsx|jsx|component)/.test(value)) return "code";
  return "summary";
}

function eventLabel(event: RuntimeEvent) {
  const type = event.eventType || event.event_type || "runtime.event";
  const message = event.message || "runtime event received";
  return `${type}: ${message}`;
}

function eventKey(event: RuntimeEvent) {
  return String(event.id || `${event.eventType || event.event_type}:${event.message || ""}:${event.createdAt || event.created_at || ""}`);
}

function VideoArtifactPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  function showFirstAvailableFrame() {
    const video = videoRef.current;
    setReady(true);
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    try {
      video.currentTime = Math.min(0.12, Math.max(0, video.duration - 0.05));
    } catch {
      // Some provider URLs do not allow seeking before enough data is buffered.
    }
  }

  return (
    <div className="videoThumb">
      <video ref={videoRef} src={src} controls playsInline preload="auto" onLoadedMetadata={showFirstAvailableFrame} onLoadedData={() => setReady(true)} />
      <span className="thumbBadge">{ready ? "First available frame thumbnail" : "Loading first frame thumbnail"}</span>
    </div>
  );
}

export default function AgentOneCodexWorkstation() {
  const [repo, setRepo] = useState("hawk7227/streamsailive");
  const [branch, setBranch] = useState("main");
  const [filePath, setFilePath] = useState("src/app/about/page.tsx");
  const [route, setRoute] = useState("/");
  const [sha, setSha] = useState("");
  const [code, setCode] = useState("");
  const [surface, setSurface] = useState<Surface>("summary");
  const [status, setStatus] = useState("Ready");
  const [summary, setSummary] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaOutput[]>([]);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [highlightRange, setHighlightRange] = useState<HighlightRange>(null);
  const [runtimeJobId, setRuntimeJobId] = useState("");
  const summaryRailRef = useRef<HTMLElement | null>(null);
  const seenRuntimeEventsRef = useRef<Set<string>>(new Set());

  const previewRoute = route || routeFromFile(filePath);
  const previewSrc = `${previewRoute}${previewRoute.includes("?") ? "&" : "?"}agent1Preview=${previewNonce}`;
  const verification = useMemo(() => verifyAgentOneWorkspaceState({
    selectedRepo: repo,
    selectedBranch: branch,
    selectedFile: filePath,
    selectedRoute: routeFromFile(filePath),
    activeWorkFile: filePath,
    activeRoute: previewRoute,
    activePreview: previewRoute,
    activeCode: code,
    activeProof: logs.join("\n"),
    activeSha: sha,
    openedFile: filePath,
    writeTarget: filePath,
    componentFile: filePath,
    buildOk: undefined,
    previewLoaded: undefined,
    previewHardCoded: false,
    lastPulledSha: sha,
  }), [repo, branch, filePath, previewRoute, code, logs, sha]);

  useEffect(() => {
    const rail = summaryRailRef.current;
    if (!rail) return;
    rail.scrollTop = rail.scrollHeight;
  }, [summary, logs, verification.proof.length, status]);

  useEffect(() => {
    if (!runtimeJobId) return;
    let stopped = false;

    async function pollRuntimeJob() {
      try {
        const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(runtimeJobId)}`, { cache: "no-store" });
        const json = await response.json().catch(() => null) as { ok?: boolean; job?: { status?: string }; events?: RuntimeEvent[]; error?: string } | null;
        if (!response.ok || !json?.ok) throw new Error(json?.error || `Runtime events request failed: ${response.status}`);
        if (stopped) return;

        const nextEvents = Array.isArray(json.events) ? json.events : [];
        const newLines: string[] = [];
        for (const event of nextEvents) {
          const key = eventKey(event);
          if (seenRuntimeEventsRef.current.has(key)) continue;
          seenRuntimeEventsRef.current.add(key);
          newLines.push(eventLabel(event));
        }

        if (newLines.length) {
          setLogs((items) => [...items.slice(-30), ...newLines].slice(-40));
          setSummary((items) => [...items.slice(-8), `Runtime job ${runtimeJobId}: ${newLines[newLines.length - 1]}`]);
          setStatus(json.job?.status ? `Runtime ${json.job.status}` : "Runtime running");
        }
      } catch (error) {
        if (stopped) return;
        const message = error instanceof Error ? error.message : "Runtime events unavailable";
        setStatus(`Runtime events blocked: ${message}`);
      }
    }

    void pollRuntimeJob();
    const timer = window.setInterval(() => void pollRuntimeJob(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [runtimeJobId]);

  function stamp(message: string) {
    const next = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} ${message}`;
    setLogs((items) => [...items.slice(-30), next]);
  }

  function mountPulledFile(detail: PulledFileDetail) {
    setRepo(detail.repo);
    setBranch(detail.branch || "main");
    setFilePath(detail.path);
    setRoute(detail.route || routeFromFile(detail.path));
    setSha(detail.sha || "");
    setCode(detail.content || "");
    setHighlightRange(null);
    setSurface("code");
    setStatus("Verified");
    setSummary((items) => [...items.slice(-8), `Mounted ${detail.path} from ${detail.repo}@${detail.branch} into the GitHub-style code editor.`]);
    stamp(`Pulled source truth ${detail.repo}@${detail.branch}:${detail.path}`);
  }

  function repairPreview() {
    const nextRoute = routeFromFile(filePath);
    setRoute(nextRoute);
    setPreviewNonce((value) => value + 1);
    setSurface("frontend");
    setStatus("Repairing");
    stamp(`Repair: re-mapped and refreshed frontend route ${nextRoute}`);
  }

  useEffect(() => {
    const stored = readStoredActiveFile();
    if (stored?.path) mountPulledFile(stored);

    function onPulledFile(event: Event) {
      const detail = (event as CustomEvent<PulledFileDetail>).detail;
      if (detail?.path) mountPulledFile(detail);
    }

    function onAgentCommand(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string; intent?: string; pulled?: PulledFileDetail }>).detail;
      const prompt = detail?.prompt || "Agent 1 command received.";
      setSurface(surfaceFromPrompt(prompt));
      setStatus("Running");
      if (prompt) setSummary((items) => [...items.slice(-8), `Chat prompt received: ${prompt}`]);
      stamp(`Agent command: ${prompt}`);
      if (detail?.pulled?.path) mountPulledFile(detail.pulled);
      if (surfaceFromPrompt(prompt) === "media" && !detail?.intent?.startsWith("generation-")) {
        const kind: MediaKind = /video|movie/.test(prompt.toLowerCase()) ? "video" : /audio|voice/.test(prompt.toLowerCase()) ? "audio" : "image";
        setMedia((items) => [{ id: `${Date.now()}`, kind, title: `${kind.toUpperCase()} output slot`, prompt, status: "Waiting for real generation artifact URL" }, ...items].slice(0, 12));
      }
    }

    function onHighlightLines(event: Event) {
      const detail = (event as CustomEvent<HighlightRange>).detail;
      if (!detail?.startLine) return;
      if (detail.filePath && detail.filePath !== filePath) return;
      setHighlightRange(detail);
      setSurface("code");
      setStatus("Running");
      setSummary((items) => [...items.slice(-8), `Agent highlighted ${detail.filePath || filePath} lines ${detail.startLine}-${detail.endLine || detail.startLine}.`]);
      stamp(`Code focus: ${detail.filePath || filePath}:${detail.startLine}-${detail.endLine || detail.startLine}`);
    }

    function onRuntimeJob(event: Event) {
      const detail = (event as CustomEvent<RuntimeJobDetail>).detail;
      if (!detail?.jobId) return;
      seenRuntimeEventsRef.current = new Set();
      setRuntimeJobId(detail.jobId);
      setStatus("Runtime queued");
      setSummary((items) => [...items.slice(-8), `Runtime job queued: ${detail.jobId}`]);
      stamp(`Runtime job queued: ${detail.jobId}`);
    }

    function onMediaOutput(event: Event) {
      const detail = (event as CustomEvent<MediaOutput>).detail;
      const nextItem = { id: detail.id || `${Date.now()}`, kind: detail.kind || "file", title: detail.title || "Generated output", prompt: detail.prompt || "Generated from chat", url: detail.url, status: detail.status || "Ready" };
      setSurface("media");
      setMedia((items) => {
        const existingIndex = items.findIndex((item) => item.id === nextItem.id);
        if (existingIndex < 0) return [nextItem, ...items].slice(0, 12);
        const nextItems = [...items];
        nextItems[existingIndex] = { ...nextItems[existingIndex], ...nextItem };
        return nextItems.slice(0, 12);
      });
      stamp(`Media output received: ${detail.title || detail.url || "artifact"}`);
    }

    window.addEventListener("streams-builder:pulled-file", onPulledFile);
    window.addEventListener("streams-builder:agent-one-command", onAgentCommand);
    window.addEventListener("streams-builder:highlight-lines", onHighlightLines);
    window.addEventListener("streams-builder:runtime-job", onRuntimeJob);
    window.addEventListener("streams-builder:media-output", onMediaOutput);
    return () => {
      window.removeEventListener("streams-builder:pulled-file", onPulledFile);
      window.removeEventListener("streams-builder:agent-one-command", onAgentCommand);
      window.removeEventListener("streams-builder:highlight-lines", onHighlightLines);
      window.removeEventListener("streams-builder:runtime-job", onRuntimeJob);
      window.removeEventListener("streams-builder:media-output", onMediaOutput);
    };
  }, [filePath]);

  return (
    <section className="agentOneCodex" aria-label="Agent 1 Codex-style workscreen">
      <main className="workscreen">
        <aside ref={summaryRailRef} className="summaryRail" aria-live="polite">
          <p className="meta">Worked in Agent 1 · {repo} · {branch}</p>
          <h3>Summary</h3>
          {summary.length ? <ul>{summary.slice(-8).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="emptySummary">No agent summary yet.</p>}
          <h3>Verification</h3>
          <ul>{verification.proof.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
          {logs.length ? <><h3>Agent Log</h3><ul>{logs.slice(-8).map((item) => <li key={item}>{item}</li>)}</ul></> : null}
        </aside>
        <section className="editorSide">
          <nav className="tabs">
            {(["summary", "code", "frontend", "diff", "logs", "media"] as Surface[]).map((item) => <button key={item} className={surface === item ? "active" : ""} onClick={() => setSurface(item)}>{item === "frontend" ? "Frontend UI" : item}</button>)}
          </nav>
          <div className="pane">
            {surface === "summary" ? <div className="textPane"><h2>{filePath}</h2><p><b>Route:</b> {previewRoute}</p><p><b>SHA:</b> {sha || "missing"}</p></div> : null}
            {surface === "code" ? <GitHubStyleCodeEditor value={code} onChange={setCode} filePath={filePath} highlightStartLine={highlightRange?.startLine} highlightEndLine={highlightRange?.endLine} /> : null}
            {surface === "frontend" ? <div className="frontendScroll"><iframe title={`Frontend UI preview for ${filePath}`} src={previewSrc} /></div> : null}
            {surface === "diff" ? <pre className="diff">{code.split("\n").slice(0, 120).map((line, index) => `${String(index + 1).padStart(4, " ")}  ${line}`).join("\n")}</pre> : null}
            {surface === "logs" ? <div className="logs">{logs.slice(-40).map((item) => <p key={item}>{item}</p>)}</div> : null}
            {surface === "media" ? <div className="media">{media.length ? media.map((item) => <article key={item.id}><b>{item.title}</b><span>{item.kind} · {item.status}</span><p>{item.prompt}</p>{!item.url && item.kind === "video" ? <div className="generationLive"><i />Real video provider job is running. First-frame thumbnail appears when the artifact URL is available.</div> : null}{item.url && item.kind === "video" ? <VideoArtifactPreview src={item.url} /> : null}{item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open output</a> : <em>Generation still running in Studio runtime.</em>}</article>) : <p>No image/video output has been routed here yet.</p>}</div> : null}
          </div>
        </section>
      </main>
      <style jsx>{`
        .agentOneCodex{height:100%;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden;background:#f6f8fa;color:#24292f;}
        .workscreen{min-width:0;min-height:0;display:grid;grid-template-columns:minmax(240px,.34fr) minmax(0,1fr);overflow:hidden;}
        .summaryRail{min-width:0;min-height:0;height:100%;overflow-y:auto;overflow-x:hidden;border-right:1px solid #d8dee4;background:#fff;padding:16px;box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#0f172a transparent;}.summaryRail::-webkit-scrollbar,.frontendScroll::-webkit-scrollbar{width:5px;height:5px}.summaryRail::-webkit-scrollbar-track,.frontendScroll::-webkit-scrollbar-track{background:transparent}.summaryRail::-webkit-scrollbar-thumb,.frontendScroll::-webkit-scrollbar-thumb{background:#0f172a;border-radius:999px}.summaryRail .meta{margin:0 0 16px;color:#57606a;font-size:12px;}.summaryRail h3{margin:14px 0 8px;font-size:18px;}.summaryRail ul{margin:0;padding-left:18px;display:grid;gap:10px;}.summaryRail li{font-size:13px;line-height:1.45;}.emptySummary{font-size:13px;color:#57606a;}
        .editorSide{min-width:0;min-height:0;display:grid;grid-template-rows:42px minmax(0,1fr);overflow:hidden;background:#fff;}.tabs{display:flex;min-width:0;overflow:auto;border-bottom:1px solid #d8dee4;background:#f6f8fa;}.tabs button{height:42px;border:0;border-right:1px solid #d8dee4;background:transparent;color:#57606a;padding:0 16px;font-size:12px;font-weight:700;cursor:pointer;text-transform:capitalize;}.tabs button.active{background:#fff;color:#24292f;box-shadow:inset 0 -2px 0 #fd8c73;}.pane{min-width:0;min-height:0;overflow:hidden;background:#fff;}.textPane{height:100%;overflow:auto;padding:18px;box-sizing:border-box;}.textPane h2{margin:0 0 12px;font-size:18px;}.textPane p{font-size:13px;color:#57606a;line-height:1.5;}.frontendScroll{height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;background:#020617;scrollbar-width:thin;scrollbar-color:#0f172a transparent;}iframe{display:block;width:100%;min-width:0;height:6000px;border:0;background:#fff;}.diff{height:100%;margin:0;overflow:auto;padding:16px;background:#fff;color:#24292f;font:12px/20px ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;}.logs{height:100%;overflow:auto;background:#020617;color:#cbd5e1;padding:16px;box-sizing:border-box;}.logs p{margin:0 0 8px;font-size:12px;line-height:1.45;}.media{height:100%;overflow:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;box-sizing:border-box;}.media article,.media>p{border:1px solid #d8dee4;border-radius:12px;background:#f6f8fa;padding:14px;margin:0;}.media b,.media span,.media p,.media em,.media a{display:block;color:#24292f;font-size:12px;line-height:1.4;}.media video{display:block;width:100%;max-height:360px;border-radius:10px;background:#020617;margin:0;object-fit:cover;}.videoThumb{position:relative;margin:8px 0;border-radius:10px;overflow:hidden;background:#020617;border:1px solid #d8dee4;}.thumbBadge{position:absolute;left:8px;bottom:8px;display:inline-block!important;width:auto;color:#fff!important;background:rgba(2,6,23,.76);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 8px;font-size:10px!important;font-weight:900;}.generationLive{display:flex;align-items:center;gap:8px;margin:8px 0;padding:10px;border:1px solid #54aeff;border-radius:10px;background:#ddf4ff;color:#0969da;font-size:12px;font-weight:800;}.generationLive i{width:8px;height:8px;border-radius:999px;background:#1a7f37;box-shadow:0 0 0 4px rgba(26,127,55,.14);}
      `}</style>
    </section>
  );
}
