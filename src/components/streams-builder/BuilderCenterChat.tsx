"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };

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

function routeFromFile(path: string) {
  if (!path.startsWith("src/app/")) return "/";
  if (!path.endsWith("/page.tsx") && !path.endsWith("/page.jsx")) return "/";
  const route = path.replace(/^src\/app/, "").replace(/\/page\.(tsx|jsx)$/, "").replace(/\/\([^)]*\)/g, "");
  return route || "/";
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
        projectId: "streams-builder",
        sessionId: "agent-1",
        repoFullName: detail.repo,
        branchName: detail.branch,
        baseBranch: detail.branch,
        targetFiles: [detail.path],
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

export default function BuilderCenterChat() {
  const [prompt, setPrompt] = useState("Agent 1, pull the selected frontend file and show it on the workscreen. Fix the pull-to-workscreen issue.");
  const [status, setStatus] = useState("Agent 1 command bridge ready");
  const [running, setRunning] = useState(false);

  async function runAgentOnePrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!prompt.trim() || running) return;
    setRunning(true);
    setStatus("Agent 1 running: interpreting prompt, pulling source truth, rebuilding workscreen...");
    try {
      const command = parseAgentOnePrompt(prompt);
      const params = new URLSearchParams({ repo: command.repo, ref: command.branch, path: command.path });
      const response = await fetch(`/api/streams-builder/github/file?${params.toString()}`, { cache: "no-store" });
      const json = (await readJson(response)) as FileResult;
      if (!json.ok) throw new Error(json.error || "Agent 1 could not pull the requested file.");

      const pulledPath = json.path || command.path;
      const detail: PulledFileDetail = {
        repo: command.repo,
        branch: command.branch,
        path: pulledPath,
        folder: pulledPath.split("/").slice(0, -1).join("/"),
        sha: json.sha || "",
        content: json.content || "",
        route: json.frontendRoute || json.sourceTruth?.route || routeFromFile(pulledPath),
      };

      window.localStorage.setItem("streams-builder:active-file", JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail }));
      window.dispatchEvent(new CustomEvent("streams-builder:agent-one-command", { detail: { prompt, command, pulled: detail, intent: "pull-file-to-workscreen" } }));
      const queueingMessage = `Runtime bridge queueing for ${detail.repo}@${detail.branch}:${detail.path}`;
      sendAgentLog(queueingMessage, "runtime-queueing", detail);
      setStatus(`Agent 1 pulled source truth: ${detail.repo}:${detail.path}. Queueing runtime events...`);

      try {
        const runtime = await queueRuntime(detail, prompt);
        if (runtime?.jobId) {
          window.dispatchEvent(new CustomEvent("streams-builder:runtime-job", { detail: runtime }));
          const queuedMessage = `Runtime bridge queued job ${runtime.jobId} for ${detail.repo}@${detail.branch}:${detail.path}`;
          sendAgentLog(queuedMessage, "runtime-queued", detail);
          setStatus(`Agent 1 queued runtime events: ${runtime.jobId}`);
        } else {
          const completedMessage = `Runtime bridge returned no job id after source truth pull for ${detail.path}`;
          sendAgentLog(completedMessage, "runtime-no-job", detail);
          setStatus(`Agent 1 completed pull-to-workscreen: ${detail.path} → ${detail.route}`);
        }
      } catch (runtimeError) {
        const message = runtimeError instanceof Error ? runtimeError.message : "unknown runtime bridge failure";
        sendAgentLog(`Runtime bridge blocked: ${message}`, "runtime-blocked", detail);
        setStatus(`Agent 1 pulled source truth; runtime events blocked: ${message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown command failure";
      sendAgentLog(`Agent 1 blocked before runtime: ${message}`, "agent-blocked");
      setStatus(`Agent 1 blocked: ${message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="builderChatFrame" aria-label="Existing Streams AI mobile chat">
      <iframe title="Streams AI" src="/streams-ai?builderMode=1" />
      <form className="agentOneCommandBar" onSubmit={runAgentOnePrompt} aria-label="Agent 1 Codex-style command prompt">
        <label>
          <b>Agent 1 chat command</b>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Agent 1, pull src/app/about/page.tsx and show it on the workscreen" />
        </label>
        <button type="submit" disabled={running}>{running ? "Agent running" : "Start Agent 1"}</button>
        <p>{status}</p>
      </form>
      <style jsx>{`
        .builderChatFrame {
          width: min(100%, 430px);
          max-width: 430px;
          min-width: 320px;
          height: min(932px, calc(100dvh - 24px));
          min-height: 640px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          box-sizing: border-box;
          display:grid;
          grid-template-rows:minmax(0,1fr) auto;
        }
        iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #020713;
        }
        .agentOneCommandBar{display:grid;gap:6px;padding:8px;border-top:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.96);box-sizing:border-box;}
        label{display:grid;gap:4px;min-width:0;}b{color:#6ee7b7;font-size:9px;text-transform:uppercase;letter-spacing:.05em;}textarea{width:100%;height:58px;resize:none;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#020617;color:#fff;padding:8px;font-size:10px;line-height:1.35;outline:none;box-sizing:border-box;}button{height:30px;border:1px solid rgba(110,231,183,.32);border-radius:10px;background:#7c3aed;color:#fff;font-size:10px;font-weight:900;cursor:pointer;}button:disabled{opacity:.55;cursor:not-allowed;}p{margin:0;color:#cbd5e1;font-size:9px;line-height:1.35;}
      `}</style>
    </section>
  );
}
