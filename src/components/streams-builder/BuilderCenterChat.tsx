"use client";

import { FormEvent, useState } from "react";
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

type LocalMessage = { id: string; role: "assistant" | "user"; content: string };

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`);
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function workstationId(name: string) {
  return String(name || "workstation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workstation";
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

function parseAgentOnePrompt(prompt: string) {
  const live = readTopRowSourceTruth();
  const last = readLastActiveFile();
  const repo = prompt.match(/(?:repo|repository)\s+([\w.-]+\/[\w.-]+)/i)?.[1] || live.repo || last?.repo || "hawk7227/streamsailive";
  const branch = prompt.match(/(?:branch|ref)\s+([\w./-]+)/i)?.[1] || live.branch || last?.branch || "main";
  const path = prompt.match(/(src\/[\w./()\[\]-]+\.(?:tsx|jsx|ts|js))/i)?.[1] || live.path || last?.path || "src/app/page.tsx";
  return { repo, branch, path };
}

function publishSummary(phase: string, message: string) {
  window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase, message } }));
}

function sendAgentLog(prompt: string, intent: string, pulled?: PulledFileDetail) {
  window.dispatchEvent(new CustomEvent("streams-builder:agent-one-command", { detail: { prompt, intent, pulled } }));
}

export default function BuilderCenterChat({ activeModule, connection, onConnectionChange }: Props) {
  const [prompt, setPrompt] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("Agent 1, pull the selected frontend file and show it on the workscreen.");
  const [status, setStatus] = useState("Local chat console restored. Embedded iframe is disabled so the builder stays stable.");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([
    { id: "welcome", role: "assistant", content: "Chat console is ready. Use the footer composer for notes, or Agent 1 Source Pull to pull a file into the workscreen." },
  ]);

  function addMessage(role: LocalMessage["role"], content: string) {
    setMessages((current) => [...current.slice(-20), { id: createId(role), role, content }]);
  }

  function connectToActiveWorkstation() {
    const next = {
      connected: true,
      activeWorkstationId: workstationId(activeModule),
      activeWorkstationName: activeModule,
      sessionId: "agent-1",
    };
    onConnectionChange(next);
    setStatus(`Connected local Agent 1 controls to ${activeModule}.`);
    publishSummary("bridge", `Local Agent 1 controls connected to ${activeModule}.`);
  }

  function disconnectWorkstation() {
    const next = { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1" };
    onConnectionChange(next);
    setStatus("Local Agent 1 controls are standalone.");
    publishSummary("bridge", "Local Agent 1 controls disconnected from workstation.");
  }

  async function runAgentOneText(nextPrompt: string) {
    const cleanPrompt = String(nextPrompt || "").trim();
    if (!cleanPrompt || running) return;
    setRunning(true);
    addMessage("user", cleanPrompt);
    setStatus("Agent 1 running: pulling source truth...");

    try {
      if (isStudioVideoRequest(cleanPrompt)) {
        await runStudioVideoLane(cleanPrompt, setStatus);
        addMessage("assistant", "Studio video lane started.");
        return;
      }

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
      window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail: { phase: "file-pulled", source: "agent-one", repo: detail.repo, branch: detail.branch, filePath: detail.path, route: detail.route, message: `Agent 1 pulled ${detail.repo}@${detail.branch}:${detail.path}.` } }));
      sendAgentLog(`Agent 1 pulled ${detail.repo}@${detail.branch}:${detail.path}`, "pull-file-to-workscreen", detail);
      publishSummary("file-pulled", `Agent 1 pulled ${detail.repo}@${detail.branch}:${detail.path}.`);
      setStatus(`Pulled ${detail.path} to the workscreen.`);
      addMessage("assistant", `Pulled ${detail.path} into the workscreen. Route: ${detail.route}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown command failure";
      sendAgentLog(`Agent 1 blocked: ${message}`, "agent-blocked");
      setStatus(`Agent 1 blocked: ${message}`);
      addMessage("assistant", `Agent 1 blocked: ${message}`);
    } finally {
      setRunning(false);
    }
  }

  async function runAgentOnePrompt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await runAgentOneText(agentPrompt);
  }

  function sendFooterChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = prompt.trim();
    if (!clean) return;
    setPrompt("");
    addMessage("user", clean);
    const response = clean.toLowerCase().includes("pull") || clean.toLowerCase().includes("agent 1")
      ? "Use Agent 1 Source Pull below to pull real source into the workscreen without loading the freezing iframe."
      : "I’m in stable local console mode. The embedded iPhone iframe is disabled to prevent freezes, but the footer composer and Agent 1 controls are available.";
    addMessage("assistant", response);
  }

  return (
    <section className="builderChatFrame" aria-label="Stable Streams Builder chat console">
      <section className="localChatConsole">
        <div className="orb" />
        <h2>Ask, build, create, launch.</h2>
        <div className="messageList" aria-label="Local chat messages">
          {messages.map((message) => <div key={message.id} className={message.role === "user" ? "msg user" : "msg assistant"}>{message.content}</div>)}
        </div>
        <form className="footerComposer" onSubmit={sendFooterChat} aria-label="Chat console composer">
          <button type="button" aria-label="Add">+</button>
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask anything" />
          <button type="submit" aria-label="Send">↑</button>
        </form>
        <nav className="mobileFooter" aria-label="Mobile footer">
          <button type="button">Chat</button>
          <button type="button">Build</button>
          <button type="button">Media</button>
          <button type="button">More</button>
        </nav>
      </section>
      <section className="connectionBar" aria-label="Agent 1 workstation connection">
        <div className="connectionStatus">
          <b>Agent 1 connection</b>
          <span>{connection.connected ? `Connected to ${connection.activeWorkstationName}` : "Standalone stable mode"}</span>
        </div>
        <div className="connectionActions">
          {connection.connected ? <button type="button" onClick={disconnectWorkstation}>Disconnect</button> : <button type="button" onClick={connectToActiveWorkstation}>Connect {activeModule}</button>}
          <button type="button" onClick={() => setStatus("Local chat console and footer are active. Iframe remains parked for stability.")}>Test Stable</button>
        </div>
        <p>{status}</p>
        <details className="fallbackCommand" open>
          <summary>Agent 1 source pull</summary>
          <form onSubmit={runAgentOnePrompt} aria-label="Agent 1 source pull prompt">
            <textarea value={agentPrompt} onChange={(event) => setAgentPrompt(event.target.value)} placeholder="Agent 1, pull src/app/page.tsx and show it on the workscreen" />
            <button type="submit" disabled={running}>{running ? "Agent running" : "Run Agent 1"}</button>
          </form>
        </details>
      </section>
      <style jsx>{`
        .builderChatFrame{width:min(100%,430px);max-width:430px;min-width:320px;height:min(932px,calc(100dvh - 24px));min-height:640px;overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);box-sizing:border-box;display:grid;grid-template-rows:minmax(0,1fr) auto;}
        .localChatConsole{min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;align-items:start;gap:14px;padding:42px 14px 10px;background:linear-gradient(180deg,#020713,#04111f);text-align:center;overflow:hidden;}
        .orb{justify-self:center;width:76px;height:76px;border-radius:24px;background:radial-gradient(circle at 50% 50%,#22d3ee 0 12%,#7c3aed 34%,#d946ef 72%);box-shadow:0 0 42px rgba(124,58,237,.45);}
        h2{margin:0;color:#f8fafc;font-size:23px;line-height:1.15;font-weight:900;}
        .messageList{min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:2px 3px 8px;text-align:left;}
        .msg{max-width:92%;border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:9px 10px;color:#e2e8f0;font-size:11px;line-height:1.35;background:rgba(15,23,42,.72);}
        .msg.user{align-self:flex-end;background:rgba(124,58,237,.28);border-color:rgba(168,85,247,.32);}.msg.assistant{align-self:flex-start;}
        .footerComposer{display:grid;grid-template-columns:36px minmax(0,1fr) 42px;gap:7px;align-items:center;border:1px solid rgba(168,85,247,.45);border-radius:22px;background:rgba(49,18,89,.78);box-shadow:0 0 32px rgba(124,58,237,.25);padding:6px;}
        .footerComposer input{height:36px;min-width:0;border:0;background:transparent;color:#fff;outline:none;font-size:12px;font-weight:800;}.footerComposer input::placeholder{color:#fff;opacity:.92;}.footerComposer button{height:36px;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-size:16px;font-weight:900;cursor:pointer;}.footerComposer button:first-child{background:rgba(30,41,59,.96);}
        .mobileFooter{height:38px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;border-top:1px solid rgba(148,163,184,.14);padding-top:6px;}
        .mobileFooter button{height:28px;border:0;border-radius:10px;background:rgba(15,23,42,.92);color:#cbd5e1;font-size:10px;font-weight:900;cursor:pointer;}.mobileFooter button:first-child{background:#7c3aed;color:#fff;}
        .connectionBar{display:grid;gap:7px;padding:8px;border-top:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.96);box-sizing:border-box;}
        .connectionStatus{display:grid;gap:2px;}.connectionStatus b{color:#6ee7b7;font-size:9px;text-transform:uppercase;letter-spacing:.05em;}.connectionStatus span{color:#fff;font-size:11px;font-weight:800;}
        .connectionActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}.connectionActions button,.fallbackCommand button{height:30px;border:1px solid rgba(110,231,183,.32);border-radius:10px;background:#7c3aed;color:#fff;font-size:10px;font-weight:900;cursor:pointer;}.connectionActions button:first-child{background:#065f46;color:#6ee7b7;}.connectionActions button:disabled,.fallbackCommand button:disabled{opacity:.55;cursor:not-allowed;}
        p{margin:0;color:#cbd5e1;font-size:9px;line-height:1.35;}.fallbackCommand{border:1px solid rgba(148,163,184,.12);border-radius:10px;padding:6px;background:#020617;}.fallbackCommand summary{cursor:pointer;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase;}.fallbackCommand form{display:grid;gap:6px;margin-top:6px;}textarea{width:100%;height:64px;resize:none;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#020617;color:#fff;padding:8px;font-size:10px;line-height:1.35;outline:none;box-sizing:border-box;}
      `}</style>
    </section>
  );
}
