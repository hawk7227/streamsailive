"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isStudioVideoRequest, runStudioVideoLane } from "./BuilderStudioGenerationLane";

type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };
type BuilderChatConnection = { connected: boolean; activeWorkstationId: string; activeWorkstationName: string; sessionId: string };
type Props = { activeModule: string; connection: BuilderChatConnection; onConnectionChange: (next: BuilderChatConnection) => void };
type FileResult = { ok: boolean; error?: string; path?: string; sha?: string; frontendRoute?: string; content?: string; sourceTruth?: { route?: string; file?: string } };
type ChatMessage = { id: string; role: "assistant" | "user"; content: string; streaming?: boolean; error?: boolean };
type ComposerAttachment = { id: string; name: string; mimeType?: string; sizeBytes?: number; kind?: string; storageUrl?: string; previewUrl?: string; publicUrl?: string };

const UUID_PATH = /\/streams-ai\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;
const COMPOSER_MIN_HEIGHT = 38;
const COMPOSER_MAX_HEIGHT = 168;

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`); }
}

function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function workstationId(name: string) { return String(name || "workstation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workstation"; }
function routeFromFile(path: string) { if (!path.startsWith("src/app/") || (!path.endsWith("/page.tsx") && !path.endsWith("/page.jsx"))) return "/"; return path.replace(/^src\/app/, "").replace(/\/page\.(tsx|jsx)$/, "").replace(/\/\([^)]*\)/g, "") || "/"; }
function routeFromPrompt(prompt: string, fallback: string) { return prompt.match(/route\s+(\/[^\s]+)/i)?.[1] || fallback || "/"; }
function activeProjectId() { try { return window.localStorage.getItem("streams-ai:active-project-id") || ""; } catch { return ""; } }
function activeProjectName() { try { return window.localStorage.getItem("streams-ai:active-project-name") || "StreamsAI project"; } catch { return "StreamsAI project"; } }
function readLastActiveFile() { try { const raw = window.localStorage.getItem("streams-builder:active-file"); return raw ? JSON.parse(raw) as Partial<PulledFileDetail> : null; } catch { return null; } }
function readTopRowSourceTruth() { const strip = document.querySelector(".topControlStrip"); const selects = strip?.querySelectorAll("select"); const inputs = strip?.querySelectorAll("input"); return { repo: selects?.[0] instanceof HTMLSelectElement ? selects[0].value : "", path: selects?.[2] instanceof HTMLSelectElement ? selects[2].value : "", branch: inputs?.[0] instanceof HTMLInputElement ? inputs[0].value : "" }; }
function parseAgentOnePrompt(prompt: string) { const live = readTopRowSourceTruth(); const last = readLastActiveFile(); return { repo: prompt.match(/(?:repo|repository)\s+([\w.-]+\/[\w.-]+)/i)?.[1] || live.repo || last?.repo || "hawk7227/streamsailive", branch: prompt.match(/(?:branch|ref)\s+([\w./-]+)/i)?.[1] || live.branch || last?.branch || "main", path: prompt.match(/(src\/[\w./()\[\]-]+\.(?:tsx|jsx|ts|js))/i)?.[1] || live.path || last?.path || "src/app/page.tsx" }; }
function publishSummary(phase: string, message: string) { window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase, message } })); }
function sendAgentLog(prompt: string, intent: string, pulled?: PulledFileDetail) { window.dispatchEvent(new CustomEvent("streams-builder:agent-one-command", { detail: { prompt, intent, pulled } })); }

function parseSseBlock(block: string) {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try { return { event, payload: JSON.parse(data.join("\n")) as Record<string, any> }; } catch { return { event, payload: { token: data.join("\n") } }; }
}

function normalizeAttachment(asset: Record<string, any>): ComposerAttachment {
  return {
    id: String(asset.id || asset.assetId || asset.storageUrl || asset.previewUrl || asset.name || createId("attachment")),
    name: String(asset.name || "Attached file"),
    mimeType: asset.mimeType || asset.mime_type || undefined,
    sizeBytes: Number(asset.sizeBytes || asset.size_bytes || 0),
    kind: asset.kind || undefined,
    storageUrl: asset.storageUrl || asset.storage_url || undefined,
    previewUrl: asset.previewUrl || asset.preview_url || undefined,
    publicUrl: asset.publicUrl || asset.public_url || undefined,
  };
}

export default function BuilderCenterChat({ activeModule, connection, onConnectionChange }: Props) {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("Agent 1, pull the selected frontend file and show it on the workscreen.");
  const [status, setStatus] = useState("Connected to the real StreamsAI conversation service.");
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "assistant", content: "StreamsAI is connected. Ask a normal question here, or use Agent 1 Source Pull for an exact repository file." }]);
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "auto";
    const nextHeight = Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, element.scrollHeight));
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, [prompt, attachments.length]);

  function addMessage(role: ChatMessage["role"], content: string, extra: Partial<ChatMessage> = {}) {
    const id = createId(role);
    setMessages((current) => [...current.slice(-49), { id, role, content, ...extra }]);
    return id;
  }

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...patch } : message));
  }

  function connectToActiveWorkstation() {
    const next = { connected: true, activeWorkstationId: workstationId(activeModule), activeWorkstationName: activeModule, sessionId: connection.sessionId || pathname.match(UUID_PATH)?.[1] || "" };
    onConnectionChange(next);
    setStatus(`Connected StreamsAI context to ${activeModule}.`);
    publishSummary("bridge", `StreamsAI context connected to ${activeModule}.`);
  }

  function disconnectWorkstation() {
    onConnectionChange({ connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: connection.sessionId || "" });
    setStatus("StreamsAI chat is standalone from the workstation.");
    publishSummary("bridge", "StreamsAI chat disconnected from workstation context.");
  }

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files || []);
    if (!selected.length || uploading) return;
    setUploading(true);
    setStatus(`Uploading ${selected.length} attachment${selected.length === 1 ? "" : "s"}…`);
    try {
      const form = new FormData();
      selected.forEach((file) => form.append("file", file));
      const response = await fetch("/api/streams-ai/assets", { method: "POST", credentials: "same-origin", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false || payload?.success === false) throw new Error(payload?.error || "Attachment upload failed.");
      const uploaded = (Array.isArray(payload.assets) ? payload.assets : Array.isArray(payload.files) ? payload.files : []).map(normalizeAttachment);
      if (!uploaded.length) throw new Error("The upload completed without an attachment record.");
      setAttachments((current) => {
        const merged = [...current];
        for (const item of uploaded) if (!merged.some((existing) => existing.id === item.id)) merged.push(item);
        return merged.slice(0, 20);
      });
      setStatus(`${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} ready.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Attachment upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function sendRealChat(clean: string, sentAttachments: ComposerAttachment[]) {
    const assistantId = addMessage("assistant", "", { streaming: true });
    const activeFile = readLastActiveFile();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setStatus("StreamsAI is responding…");

    try {
      const requestedSessionId = connection.sessionId || pathname.match(UUID_PATH)?.[1] || "";
      const response = await fetch("/api/streams-ai/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({
          sessionId: requestedSessionId || undefined,
          message: clean || "\u200B",
          attachments: sentAttachments,
          runAssistant: true,
          idempotencyKey: createId("builder-chat"),
          metadata: {
            source: "streams-builder-connected-chat",
            projectId: activeProjectId() || undefined,
            projectName: activeProjectName(),
            activeModule,
            connectedWorkstation: connection.connected ? connection.activeWorkstationName : null,
            repository: activeFile?.repo || null,
            branch: activeFile?.branch || null,
            filePath: activeFile?.path || null,
            route: activeFile?.route || null,
            attachmentCount: sentAttachments.length,
          },
        }),
      });
      if (!response.ok || !response.body) throw new Error((await response.text().catch(() => "")) || `Chat request failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const parsed = parseSseBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          if (!parsed) continue;
          if (parsed.event === "response" && typeof parsed.payload.token === "string") {
            answer += parsed.payload.token;
            updateMessage(assistantId, { content: answer, streaming: true });
          }
          if (parsed.event === "activity") setStatus(String(parsed.payload.statusText || "StreamsAI is working…"));
          if (parsed.event === "complete") {
            const sessionId = String(parsed.payload.sessionId || requestedSessionId || "");
            if (sessionId && sessionId !== connection.sessionId) onConnectionChange({ ...connection, sessionId });
            updateMessage(assistantId, { content: answer || "StreamsAI completed without visible text.", streaming: false });
            setStatus("Response complete.");
          }
          if (parsed.event === "error") throw new Error(String(parsed.payload.message || parsed.payload.detail || "StreamsAI could not complete the response."));
        }
      }
      updateMessage(assistantId, { content: answer || "StreamsAI completed without visible text.", streaming: false });
      publishSummary("chat.response.complete", "StreamsAI completed a connected builder chat response.");
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      const message = cancelled ? "Response stopped." : error instanceof Error ? error.message : "StreamsAI chat failed.";
      updateMessage(assistantId, { content: message, streaming: false, error: !cancelled });
      setStatus(message);
      publishSummary(cancelled ? "chat.response.cancelled" : "chat.response.failed", message);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  async function runAgentOneText(nextPrompt: string) {
    const cleanPrompt = String(nextPrompt || "").trim();
    if (!cleanPrompt || running) return;
    setRunning(true);
    addMessage("user", cleanPrompt);
    setStatus("Agent 1 running: pulling source truth…");
    try {
      if (isStudioVideoRequest(cleanPrompt)) { await runStudioVideoLane(cleanPrompt, setStatus); addMessage("assistant", "Studio video lane started."); return; }
      const command = parseAgentOnePrompt(cleanPrompt);
      const response = await fetch(`/api/streams-builder/github/file?${new URLSearchParams({ repo: command.repo, ref: command.branch, path: command.path })}`, { cache: "no-store" });
      const json = (await readJson(response)) as FileResult;
      if (!json.ok) throw new Error(json.error || "Agent 1 could not pull the requested file.");
      const pulledPath = json.path || command.path;
      const detail: PulledFileDetail = { repo: command.repo, branch: command.branch, path: pulledPath, folder: pulledPath.split("/").slice(0, -1).join("/"), sha: json.sha || "", content: json.content || "", route: routeFromPrompt(cleanPrompt, json.frontendRoute || json.sourceTruth?.route || routeFromFile(pulledPath)) };
      window.localStorage.setItem("streams-builder:active-file", JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail }));
      window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail: { phase: "file-pulled", source: "agent-one", repo: detail.repo, branch: detail.branch, filePath: detail.path, route: detail.route, message: `Agent 1 pulled ${detail.repo}@${detail.branch}:${detail.path}.` } }));
      sendAgentLog(`Agent 1 pulled ${detail.repo}@${detail.branch}:${detail.path}`, "pull-file-to-workscreen", detail);
      publishSummary("file-pulled", `Agent 1 pulled ${detail.repo}@${detail.branch}:${detail.path}.`);
      setStatus(`Pulled ${detail.path} to the workscreen.`);
      addMessage("assistant", `Pulled ${detail.path} into the workscreen. Route: ${detail.route}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown command failure";
      sendAgentLog(`Agent 1 blocked: ${message}`, "agent-blocked");
      setStatus(`Agent 1 blocked: ${message}`);
      addMessage("assistant", `Agent 1 blocked: ${message}`, { error: true });
    } finally { setRunning(false); }
  }

  async function runAgentOnePrompt(event?: FormEvent<HTMLFormElement>) { event?.preventDefault(); await runAgentOneText(agentPrompt); }
  async function sendFooterChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const clean = prompt.trim();
    if ((!clean && !attachments.length) || running || uploading) return;
    const sentAttachments = attachments;
    setPrompt("");
    setAttachments([]);
    const userSummary = clean || `Attached ${sentAttachments.length} file${sentAttachments.length === 1 ? "" : "s"}.`;
    addMessage("user", sentAttachments.length ? `${userSummary}\n\n${sentAttachments.map((item) => `📎 ${item.name}`).join("\n")}` : userSummary);
    await sendRealChat(clean, sentAttachments);
  }

  return (
    <section className="builderChatFrame" aria-label="Connected StreamsAI Builder chat console">
      <section className="localChatConsole">
        <div className="orb" />
        <h2>Ask, build, create, launch.</h2>
        <div className="messageList" aria-label="Connected chat messages" aria-live="polite">
          {messages.map((message) => <div key={message.id} className={`msg ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}`}>{message.content || "Thinking…"}</div>)}
        </div>
        <form className="footerComposer" onSubmit={sendFooterChat} aria-label="Connected StreamsAI composer">
          {attachments.length ? (
            <div className="composerAttachments" aria-label="Message attachments">
              {attachments.map((attachment) => (
                <span className="attachmentChip" key={attachment.id}>
                  <span className="attachmentName">{attachment.name}</span>
                  <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>×</button>
                </span>
              ))}
            </div>
          ) : null}
          <input ref={fileInputRef} className="hiddenFileInput" type="file" multiple onChange={(event) => void uploadFiles(event.currentTarget.files || [])} />
          <button type="button" aria-label="Add files" disabled={running || uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? "…" : "+"}</button>
          <textarea
            ref={composerRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={attachments.length ? "Add a message about these files" : "Ask anything"}
            rows={1}
            disabled={running}
            aria-label="Message"
          />
          {running ? <button type="button" aria-label="Stop response" onClick={() => abortRef.current?.abort()}>■</button> : <button type="submit" aria-label="Send message" disabled={uploading || (!prompt.trim() && !attachments.length)}>↑</button>}
        </form>
        <nav className="mobileFooter" aria-label="Builder console modes">
          <button type="button">Chat</button><button type="button">Build</button><button type="button">Media</button><button type="button">More</button>
        </nav>
      </section>
      <section className="connectionBar" aria-label="Agent 1 workstation connection">
        <div className="connectionStatus"><b>Agent 1 connection</b><span>{connection.connected ? `Connected to ${connection.activeWorkstationName}` : "Standalone chat mode"}</span></div>
        <div className="connectionActions">
          {connection.connected ? <button type="button" onClick={disconnectWorkstation}>Disconnect</button> : <button type="button" onClick={connectToActiveWorkstation}>Connect {activeModule}</button>}
          <button type="button" onClick={() => setStatus("The real StreamsAI message endpoint and source-pull controls are active.")}>Test connection</button>
        </div>
        <p>{status}</p>
        <details className="fallbackCommand">
          <summary>Agent 1 source pull</summary>
          <form onSubmit={runAgentOnePrompt} aria-label="Agent 1 source pull prompt">
            <textarea value={agentPrompt} onChange={(event) => setAgentPrompt(event.target.value)} placeholder="Agent 1, pull src/app/page.tsx and show it on the workscreen" />
            <button type="submit" disabled={running}>{running ? "Agent running" : "Run Agent 1"}</button>
          </form>
        </details>
      </section>
      <style jsx>{`
        .builderChatFrame{width:min(100%,430px);max-width:430px;min-width:320px;height:min(932px,calc(100dvh - 24px));min-height:640px;overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.78);box-sizing:border-box;display:grid;grid-template-rows:minmax(0,1fr) auto}
        .localChatConsole{min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;align-items:start;gap:14px;padding:30px 14px 10px;background:linear-gradient(180deg,#020713,#04111f);text-align:center;overflow:hidden}
        .orb{justify-self:center;width:70px;height:70px;border-radius:22px;background:radial-gradient(circle at 50% 50%,#22d3ee 0 12%,#7c3aed 34%,#d946ef 72%);box-shadow:0 0 42px rgba(124,58,237,.45)}
        h2{margin:0;color:#f8fafc;font-size:23px;line-height:1.15;font-weight:900}.messageList{min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:2px 3px 8px;text-align:left}
        .msg{max-width:92%;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:10px 11px;color:#e2e8f0;font-size:14px;line-height:1.5;background:rgba(15,23,42,.72)}.msg.user{align-self:flex-end;background:rgba(124,58,237,.28);border-color:rgba(168,85,247,.32)}.msg.assistant{align-self:flex-start}.msg.streaming{border-color:rgba(34,211,238,.4)}.msg.error{border-color:rgba(248,113,113,.55);color:#fecaca}
        .footerComposer{display:grid;grid-template-columns:38px minmax(0,1fr) 42px;grid-template-rows:auto auto;gap:7px;align-items:end;border:1px solid rgba(168,85,247,.45);border-radius:24px;background:rgba(49,18,89,.78);box-shadow:0 0 32px rgba(124,58,237,.25);padding:7px;box-sizing:border-box;min-height:52px;max-height:248px;overflow:hidden;transition:min-height .12s ease,height .12s ease}
        .composerAttachments{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;max-height:72px;overflow:auto;padding:1px 2px 4px;text-align:left}.attachmentChip{display:flex;align-items:center;min-width:0;max-width:100%;height:30px;border:1px solid rgba(196,181,253,.42);border-radius:999px;background:rgba(76,29,149,.74);padding:0 4px 0 10px;color:#ede9fe;font-size:11px;font-weight:800}.attachmentName{min-width:0;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.attachmentChip button{width:24px!important;height:24px!important;margin-left:4px;background:transparent!important;color:#ddd6fe!important;font-size:16px!important}.hiddenFileInput{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
        .footerComposer textarea{field-sizing:content;width:100%;min-width:0;min-height:38px;max-height:168px;resize:none;overflow-y:hidden;border:0;background:transparent;color:#fff;outline:none;padding:8px 4px;font:700 15px/1.4 inherit;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere}.footerComposer textarea::placeholder{color:#fff;opacity:.82}.footerComposer button{width:38px;height:38px;align-self:end;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-size:16px;font-weight:900;cursor:pointer;flex:0 0 auto}.footerComposer button:first-of-type{background:rgba(30,41,59,.96)}.footerComposer button:disabled{opacity:.5;cursor:not-allowed}
        .mobileFooter{height:38px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;border-top:1px solid rgba(148,163,184,.14);padding-top:6px}.mobileFooter button{height:28px;border:0;border-radius:10px;background:rgba(15,23,42,.92);color:#cbd5e1;font-size:11px;font-weight:900;cursor:pointer}.mobileFooter button:first-child{background:#7c3aed;color:#fff}
        .connectionBar{display:grid;gap:7px;padding:8px;border-top:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.96);box-sizing:border-box}.connectionStatus{display:grid;gap:2px}.connectionStatus b{color:#6ee7b7;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.connectionStatus span{color:#fff;font-size:12px;font-weight:800}.connectionActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.connectionActions button,.fallbackCommand button{height:32px;border:1px solid rgba(110,231,183,.32);border-radius:10px;background:#7c3aed;color:#fff;font-size:11px;font-weight:900;cursor:pointer}.connectionActions button:first-child{background:#065f46;color:#6ee7b7}.connectionActions button:disabled,.fallbackCommand button:disabled{opacity:.55;cursor:not-allowed}.connectionBar p{margin:0;color:#cbd5e1;font-size:11px;line-height:1.4}.fallbackCommand{border:1px solid rgba(148,163,184,.12);border-radius:10px;padding:6px;background:#020617}.fallbackCommand summary{cursor:pointer;color:#94a3b8;font-size:10px;font-weight:900;text-transform:uppercase}.fallbackCommand form{display:grid;gap:6px;margin-top:6px}.fallbackCommand textarea{width:100%;height:68px;resize:vertical;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#020617;color:#fff;padding:8px;font-size:12px;line-height:1.4;outline:none;box-sizing:border-box}
      `}</style>
    </section>
  );
}
