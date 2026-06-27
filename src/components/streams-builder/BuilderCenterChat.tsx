"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isStudioVideoRequest, runStudioVideoLane } from "./BuilderStudioGenerationLane";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type BuilderChatConnection = { connected: boolean; activeWorkstationId: string; activeWorkstationName: string; sessionId: string };

type Props = {
  activeModule: string;
  connection: BuilderChatConnection;
  onConnectionChange: (next: BuilderChatConnection) => void;
};

type FileResult = {
  ok: boolean;
  error?: string;
  path?: string;
  sha?: string;
  frontendRoute?: string;
  content?: string;
  sourceTruth?: { route?: string; file?: string };
};

type RuntimeQueueResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  queuedJob?: { id?: string | number };
};

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`); }
}

async function runtimeHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // The runtime route will return the exact auth error if no session is available.
  }
  return headers;
}

function workstationId(name: string) {
  return String(name || "workstation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workstation";
}

function workstationNameFromId(id: string, fallback: string) {
  if (id === "visual-editing") return "Visual Editing";
  if (id === "approval-center") return "Approval Center";
  if (id === "browser-verification") return "Browser Verification";
  if (id === "repository-truth") return "Repository Truth";
  if (id === "primary-builder") return "Primary Builder";
  return fallback || "Primary Builder";
}

function routeFromFile(path: string) {
  if (!path.startsWith("src/app/")) return "/";
  if (!path.endsWith("/page.tsx") && !path.endsWith("/page.jsx")) return "/";
  const route = path.replace(/^src\/app/, "").replace(/\/page\.(tsx|jsx)$/, "").replace(/\/\([^)]*\)/g, "");
  return route || "/";
}

function routeFromPrompt(prompt: string, fallback: string) {
  return prompt.match(/route\s+(\/[^\s]+)/i)?.[1] || fallback || "/";
}

function readLastActiveFile() {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as Partial<PulledFileDetail> : null;
  } catch {
    return null;
  }
}

function readTopRowSourceTruth() {
  const strip = document.querySelector(".topControlStrip");
  const selects = strip?.querySelectorAll("select");
  const inputs = strip?.querySelectorAll("input");
  const repo = selects?.[0] instanceof HTMLSelectElement ? selects[0].value : "";
  const path = selects?.[2] instanceof HTMLSelectElement ? selects[2].value : "";
  const branch = inputs?.[0] instanceof HTMLInputElement ? inputs[0].value : "";
  return { repo, branch, path };
}

function sendAgentLog(prompt: string, intent: string, pulled?: PulledFileDetail) {
  window.dispatchEvent(new CustomEvent("streams-builder:agent-one-command", { detail: { prompt, intent, pulled } }));
}

function publishSummary(phase: string, message: string) {
  window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase, message } }));
}

function parseAgentOnePrompt(prompt: string) {
  const live = readTopRowSourceTruth();
  const last = readLastActiveFile();
  const repo = prompt.match(/(?:repo|repository)\s+([\w.-]+\/[\w.-]+)/i)?.[1] || live.repo || last?.repo || "hawk7227/streamsailive";
  const branch = prompt.match(/(?:branch|ref)\s+([\w./-]+)/i)?.[1] || live.branch || last?.branch || "main";
  const path = prompt.match(/(src\/[\w./()\[\]-]+\.(?:tsx|jsx|ts|js))/i)?.[1] || live.path || last?.path || "src/app/about/page.tsx";
  return { repo, branch, path };
}

async function queueRuntime(detail: PulledFileDetail, prompt: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch("/api/streams-builder/repository-execution", {
      method: "POST",
      headers: await runtimeHeaders(),
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        sessionId: "agent-1",
        repoFullName: detail.repo,
        branchName: detail.branch,
        baseBranch: detail.branch,
        route: detail.route,
        userPrompt: prompt,
        targetFiles: [detail.path],
        requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"],
        autonomousRepair: true,
        maxRepairAttempts: 3,
        maxFilesTouched: 4,
        runBuildAfterPatch: true,
        requireApprovalBeforePush: true,
        enqueue: true,
      }),
    });
    const json = (await readJson(response)) as RuntimeQueueResult;
    if (!response.ok || json.ok === false) throw new Error(json.error || json.message || "Runtime queue failed");
    const jobId = json.queuedJob?.id ? String(json.queuedJob.id) : "";
    if (!jobId) return null;
    return { jobId, prompt, repo: detail.repo, branch: detail.branch, path: detail.path, route: detail.route };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("runtime queue timed out after source truth pull");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function BuilderCenterChat({ activeModule, connection, onConnectionChange }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [prompt, setPrompt] = useState("Agent 1, pull the selected frontend file and show it on the workscreen. Fix the pull-to-workscreen issue.");
  const [status, setStatus] = useState("iPhone chat bridge ready");
  const [bridgeProof, setBridgeProof] = useState("not tested");
  const [lastPingId, setLastPingId] = useState("");
  const [running, setRunning] = useState(false);

  function pushConnectionState(next = connection, pingId = "") {
    frameRef.current?.contentWindow?.postMessage({ type: "streams-builder-connection-state", connection: next, pingId }, window.location.origin);
  }

  function connectToActiveWorkstation() {
    const next = { connected: true, activeWorkstationId: workstationId(activeModule), activeWorkstationName: activeModule, sessionId: "agent-1" };
    onConnectionChange(next);
    setStatus(`iPhone chat connected to ${activeModule}.`);
    publishSummary("bridge", `iPhone chat connected to ${activeModule}.`);
    window.setTimeout(() => pushConnectionState(next), 50);
  }

  function disconnectWorkstation() {
    const next = { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1" };
    onConnectionChange(next);
    setBridgeProof("not tested");
    setStatus("iPhone chat disconnected. Standalone Streams AI mode preserved.");
    publishSummary("bridge", "iPhone chat disconnected. Standalone mode preserved.");
    window.setTimeout(() => pushConnectionState(next), 50);
  }

  function testBridge() {
    if (!connection.connected || !connection.activeWorkstationId) {
      setBridgeProof("blocked");
      setStatus("Bridge test blocked: connect the iPhone chat to a workstation first.");
      return;
    }
    const pingId = `bridge-${Date.now()}`;
    setLastPingId(pingId);
    setBridgeProof("testing");
    setStatus(`Testing iPhone chat ↔ ${connection.activeWorkstationName} bridge...`);
    frameRef.current?.contentWindow?.postMessage({ type: "streams-builder-bridge-ping", pingId, connection }, window.location.origin);
    window.setTimeout(() => {
      setBridgeProof((current) => current === "testing" ? "timeout" : current);
    }, 1800);
  }

  async function runAgentOneText(nextPrompt: string, source: "local-form" | "iphone-chat" = "local-form") {
    const cleanPrompt = String(nextPrompt || "").trim();
    if (!cleanPrompt || running) return;
    if (source === "iphone-chat" && (!connection.connected || !connection.activeWorkstationId)) {
      setStatus("iPhone chat is standalone. Connect it to one workstation before routing commands.");
      return;
    }
    setRunning(true);
    setStatus(source === "iphone-chat" ? `iPhone chat command routed to ${connection.activeWorkstationName}.` : "Agent 1 running: interpreting prompt...");
    try {
      if (isStudioVideoRequest(cleanPrompt)) {
        await runStudioVideoLane(cleanPrompt, setStatus);
        return;
      }

      setStatus("Agent 1 running: interpreting prompt, pulling source truth, queueing Codex repair loop...");
      const command = parseAgentOnePrompt(cleanPrompt);
      const params = new URLSearchParams({ repo: command.repo, ref: command.branch, path: command.path });
      const response = await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as FileResult;
      if (!json.ok) throw new Error(json.error || "Agent 1 could not pull the requested file.");

      const pulledPath = json.path || command.path;
      const route = routeFromPrompt(cleanPrompt, json.frontendRoute || json.sourceTruth?.route || routeFromFile(pulledPath));
      const detail: PulledFileDetail = {
        repo: command.repo,
        branch: command.branch,
        path: pulledPath,
        folder: pulledPath.split("/").slice(0, -1).join("/"),
        sha: json.sha || "",
        content: json.content || "",
        route,
      };

      window.localStorage.setItem("streams-builder:active-file", JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail }));
      window.dispatchEvent(new CustomEvent("streams-builder:agent-one-command", { detail: { prompt: cleanPrompt, command, pulled: detail, intent: source === "iphone-chat" ? "iphone-chat-to-codex-workstation" : "pull-file-to-codex-workscreen", workstation: connection } }));
      const queueingMessage = `Codex repair loop queueing for ${detail.repo}@${detail.branch}:${detail.path}`;
      sendAgentLog(queueingMessage, "codex-runtime-queueing", detail);
      publishSummary("codex", queueingMessage);
      setStatus(`Agent 1 pulled source truth: ${detail.repo}:${detail.path}. Queueing Codex repair loop...`);
      frameRef.current?.contentWindow?.postMessage({ type: "streams-builder-status", status: `Pulled ${detail.repo}:${detail.path}`, connection }, window.location.origin);

      try {
        const runtime = await queueRuntime(detail, cleanPrompt);
        if (runtime?.jobId) {
          window.dispatchEvent(new CustomEvent("streams-builder:runtime-job", { detail: runtime }));
          const queuedMessage = `Codex repair loop queued job ${runtime.jobId} for ${detail.repo}@${detail.branch}:${detail.path}`;
          sendAgentLog(queuedMessage, "codex-runtime-queued", detail);
          publishSummary("codex", queuedMessage);
          setStatus(`Agent 1 queued Codex repair loop: ${runtime.jobId}`);
        } else {
          const completedMessage = `Codex route returned no job id after source truth pull for ${detail.path}`;
          sendAgentLog(completedMessage, "codex-no-job", detail);
          setStatus(`Agent 1 completed pull-to-workscreen: ${detail.path} → ${detail.route}`);
        }
      } catch (runtimeError) {
        const message = runtimeError instanceof Error ? runtimeError.message : "unknown runtime bridge failure";
        sendAgentLog(`Codex repair loop blocked: ${message}`, "codex-runtime-blocked", detail);
        setStatus(`Agent 1 pulled source truth; Codex repair loop blocked: ${message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown command failure";
      sendAgentLog(`Agent 1 blocked before Codex loop: ${message}`, "agent-blocked");
      setStatus(`Agent 1 blocked: ${message}`);
    } finally {
      setRunning(false);
    }
  }

  async function runAgentOnePrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await runAgentOneText(prompt, "local-form");
  }

  useEffect(() => {
    pushConnectionState(connection);
  }, [connection.connected, connection.activeWorkstationId, connection.activeWorkstationName]);

  useEffect(() => {
    function onFrameMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === "streams-builder-frame-ready") {
        setBridgeProof("frame ready");
        pushConnectionState(connection);
      }
      if (data.type === "streams-builder-bridge-pong") {
        const targetMatches = data.connection?.activeWorkstationId === connection.activeWorkstationId;
        const pingMatches = !lastPingId || !data.pingId || data.pingId === lastPingId || data.pingId === "connection-state";
        if (data.connected && targetMatches && pingMatches) {
          setBridgeProof("passed");
          const message = `Bridge proof passed: iPhone chat can see ${connection.activeWorkstationName} and workstation can see the iPhone chat.`;
          setStatus(message);
          publishSummary("bridge-proof", message);
        } else {
          setBridgeProof("failed");
          setStatus("Bridge proof failed: stale or mismatched workstation connection.");
        }
      }
      if (data.type === "streams-builder-chat-command") {
        const incoming = (data.connection || {}) as Partial<BuilderChatConnection>;
        const next = {
          connected: true,
          activeWorkstationId: incoming.activeWorkstationId || connection.activeWorkstationId || workstationId(activeModule),
          activeWorkstationName: incoming.activeWorkstationName || workstationNameFromId(incoming.activeWorkstationId || connection.activeWorkstationId || workstationId(activeModule), activeModule),
          sessionId: incoming.sessionId || "agent-1",
        };
        if (!connection.connected || connection.activeWorkstationId !== next.activeWorkstationId) {
          onConnectionChange(next);
          setBridgeProof("auto connected");
          pushConnectionState(next);
          publishSummary("bridge", `iPhone chat auto-connected to ${next.activeWorkstationName}.`);
        }
        publishSummary("iphone-command", `iPhone chat command reached ${next.activeWorkstationName}: ${String(data.message || "").slice(0, 80)}`);
        void runAgentOneText(data.message, "local-form");
      }
    }
    window.addEventListener("message", onFrameMessage);
    return () => window.removeEventListener("message", onFrameMessage);
  }, [connection.connected, connection.activeWorkstationId, connection.activeWorkstationName, lastPingId, running]);

  return (
    <section className="builderChatFrame" aria-label="Existing Streams AI mobile chat">
      <iframe ref={frameRef} title="Streams AI" src="/streams-ai?builderMode=1" onLoad={() => pushConnectionState(connection)} />
      <section className="connectionBar" aria-label="iPhone chat workstation connection">
        <div className="connectionStatus">
          <b>iPhone chat connection</b>
          <span>{connection.connected ? `Connected to ${connection.activeWorkstationName} · bridge ${bridgeProof}` : "Standalone Streams AI mode"}</span>
        </div>
        <div className="connectionActions">
          {connection.connected ? <button type="button" onClick={disconnectWorkstation}>Disconnect</button> : <button type="button" onClick={connectToActiveWorkstation}>Connect {activeModule}</button>}
          {connection.connected && connection.activeWorkstationName !== activeModule ? <button type="button" onClick={connectToActiveWorkstation}>Switch to {activeModule}</button> : <button type="button" onClick={testBridge} disabled={!connection.connected}>Test Bridge</button>}
        </div>
        <p>{status}</p>
        <details className="fallbackCommand">
          <summary>Manual bridge fallback</summary>
          <form onSubmit={runAgentOnePrompt} aria-label="Agent 1 fallback command prompt">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Agent 1, pull src/app/page.tsx and show it on the workscreen" />
            <button type="submit" disabled={running}>{running ? "Agent running" : "Run fallback"}</button>
          </form>
        </details>
      </section>
      <style jsx>{`
        .builderChatFrame{width:min(100%,430px);max-width:430px;min-width:320px;height:min(932px,calc(100dvh - 24px));min-height:640px;overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);box-sizing:border-box;display:grid;grid-template-rows:minmax(0,1fr) auto;}
        iframe{display:block;width:100%;height:100%;border:0;background:#020713;}
        .connectionBar{display:grid;gap:7px;padding:8px;border-top:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.96);box-sizing:border-box;}
        .connectionStatus{display:grid;gap:2px;}.connectionStatus b{color:#6ee7b7;font-size:9px;text-transform:uppercase;letter-spacing:.05em;}.connectionStatus span{color:#fff;font-size:11px;font-weight:800;}
        .connectionActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}.connectionActions button,.fallbackCommand button{height:30px;border:1px solid rgba(110,231,183,.32);border-radius:10px;background:#7c3aed;color:#fff;font-size:10px;font-weight:900;cursor:pointer;}.connectionActions button:first-child{background:#065f46;color:#6ee7b7;}.connectionActions button:disabled,.fallbackCommand button:disabled{opacity:.55;cursor:not-allowed;}
        p{margin:0;color:#cbd5e1;font-size:9px;line-height:1.35;}.fallbackCommand{border:1px solid rgba(148,163,184,.12);border-radius:10px;padding:6px;background:#020617;}.fallbackCommand summary{cursor:pointer;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase;}.fallbackCommand form{display:grid;gap:6px;margin-top:6px;}textarea{width:100%;height:54px;resize:none;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#020617;color:#fff;padding:8px;font-size:10px;line-height:1.35;outline:none;box-sizing:border-box;}
      `}</style>
    </section>
  );
}
