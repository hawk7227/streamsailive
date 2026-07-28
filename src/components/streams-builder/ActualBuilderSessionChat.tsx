"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { BuilderChatConnection } from "./builderSystemContract";

type Message = { id?: string; role?: string; content?: string; status?: string };
type Props = { connection: BuilderChatConnection; onConnectionChange: (next: BuilderChatConnection) => void };

const COMPOSER_MIN_HEIGHT = 52;
const COMPOSER_MAX_HEIGHT = 224;
const USER_COLLAPSE_LINES = 7;
const ASSISTANT_COLLAPSE_LINES = 14;

function querySessionId() {
  try { return new URLSearchParams(window.location.search).get("sessionId") || ""; } catch { return ""; }
}

function parseSseBlock(block: string) {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try { return { event, payload: JSON.parse(data.join("\n")) as Record<string, unknown> }; }
  catch { return { event, payload: { token: data.join("\n") } }; }
}

function messageNeedsCollapse(message: Message) {
  const content = message.content || "";
  if (!content) return false;
  const explicitLines = content.split("\n").length;
  const estimatedWrappedLines = Math.ceil(content.length / 72);
  const threshold = message.role === "user" ? USER_COLLAPSE_LINES : ASSISTANT_COLLAPSE_LINES;
  return Math.max(explicitLines, estimatedWrappedLines) > threshold;
}

export default function ActualBuilderSessionChat({ connection, onConnectionChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Loading originating StreamsAI conversation…");
  const [running, setRunning] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const sessionId = connection.sessionId && connection.sessionId !== "agent-1" ? connection.sessionId : querySessionId();

  function resizeComposer() {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    const nextHeight = Math.min(Math.max(composer.scrollHeight, COMPOSER_MIN_HEIGHT), COMPOSER_MAX_HEIGHT);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }

  function resetComposer() {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = `${COMPOSER_MIN_HEIGHT}px`;
    composer.style.overflowY = "hidden";
  }

  async function hydrate() {
    if (!sessionId) { setStatus("No originating StreamsAI session was supplied."); return; }
    const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => null) as { ok?: boolean; messages?: Message[]; error?: string } | null;
    if (!response.ok || !payload?.ok) { setStatus(payload?.error || "Could not load the originating conversation."); return; }
    setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    setStatus("StreamsAI conversation connected.");
    onConnectionChange({ connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId });
  }

  useEffect(() => { void hydrate(); }, [sessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  useEffect(() => { resizeComposer(); }, [prompt]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = prompt.trim();
    if (!clean || running || !sessionId) return;
    setPrompt("");
    window.requestAnimationFrame(resetComposer);
    setRunning(true);
    setStatus("StreamsAI is responding…");
    const userId = `local-user-${Date.now()}`;
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((items) => [...items, { id: userId, role: "user", content: clean, status: "complete" }, { id: assistantId, role: "assistant", content: "", status: "streaming" }]);
    try {
      const response = await fetch("/api/streams-ai/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sessionId, message: clean, runAssistant: true, idempotencyKey: `builder-session-${Date.now()}`, metadata: { source: "canonical-builder-session-chat", connectedWorkstation: "Primary Builder" } }),
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
            setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: answer, status: "streaming" } : item));
          }
          if (parsed.event === "activity") setStatus(String(parsed.payload.statusText || "StreamsAI is working…"));
          if (parsed.event === "error") throw new Error(String(parsed.payload.message || "StreamsAI could not complete the response."));
        }
      }
      await hydrate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "StreamsAI chat failed.";
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: message, status: "failed" } : item));
      setStatus(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="actualBuilderChat" aria-label="Originating StreamsAI conversation">
      <header><b>StreamsAI</b><span>{sessionId || "not connected"}</span></header>
      <div className="messageList">
        {messages.map((message, index) => {
          const key = message.id || `${message.role}-${index}`;
          const collapsible = message.status !== "streaming" && messageNeedsCollapse(message);
          const expanded = Boolean(expandedMessages[key]);
          return <article key={key} className={message.role === "user" ? "user" : message.status === "failed" ? "assistant failed" : "assistant"}>
            <b>{message.role === "user" ? "You" : "StreamsAI"}</b>
            <p className={collapsible && !expanded ? (message.role === "user" ? "collapsed userCollapsed" : "collapsed assistantCollapsed") : ""}>{message.content || (message.status === "streaming" ? "Thinking…" : "")}</p>
            {collapsible ? <button type="button" className="messageToggle" aria-expanded={expanded} onClick={() => setExpandedMessages((items) => ({ ...items, [key]: !expanded }))}>{expanded ? "Show less" : "Show more"}</button> : null}
          </article>;
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send}>
        <textarea ref={composerRef} rows={2} value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask anything" disabled={running || !sessionId} />
        <button className="sendButton" type="submit" disabled={running || !prompt.trim()}>↑</button>
      </form>
      <footer>{status}</footer>
      <style jsx>{`
        .actualBuilderChat{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#030817;color:#e8eefc;border-right:1px solid rgba(56,189,248,.18);overflow:hidden}
        header{height:48px;display:flex;flex-direction:column;justify-content:center;padding:0 14px;border-bottom:1px solid rgba(148,163,184,.16);background:#071124} header b{font-size:13px} header span{font:10px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;color:#7dd3fc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .messageList{min-height:0;overflow:auto;padding:14px 12px 24px;display:flex;flex-direction:column;gap:12px}.messageList article{max-width:92%;min-width:0;border:1px solid rgba(148,163,184,.18);border-radius:14px;padding:10px 12px;background:#0b152a;overflow:hidden}.messageList article.user{align-self:flex-end;background:#2b1450;border-color:rgba(168,85,247,.42)}.messageList article.assistant{align-self:flex-start}.messageList article.failed{border-color:#ef4444}.messageList b{font-size:10px;color:#7dd3fc}.messageList p{margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.45;color:#edf4ff}.messageList p.collapsed{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;position:relative}.messageList p.userCollapsed{-webkit-line-clamp:${USER_COLLAPSE_LINES}}.messageList p.assistantCollapsed{-webkit-line-clamp:${ASSISTANT_COLLAPSE_LINES}}.messageToggle{display:inline-flex;width:auto;height:auto;margin-top:8px;padding:0;border:0;border-radius:0;background:transparent;color:#7dd3fc;font-size:11px;font-weight:800;cursor:pointer}.messageToggle:hover{text-decoration:underline}
        form{display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:end;gap:8px;margin:0 10px 8px;padding:8px;border:1px solid rgba(168,85,247,.44);border-radius:18px;background:#241044;overflow:hidden}textarea{box-sizing:border-box;width:100%;min-height:${COMPOSER_MIN_HEIGHT}px;max-height:${COMPOSER_MAX_HEIGHT}px;resize:none;overflow-y:hidden;border:0;outline:0;background:transparent;color:#fff;font:13px/1.45 Inter,system-ui,sans-serif;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere;scrollbar-width:thin}textarea:disabled{opacity:.65}.sendButton{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:14px;background:linear-gradient(135deg,#9333ea,#22d3ee);color:white;font-size:22px;font-weight:900;cursor:pointer}.sendButton:disabled{opacity:.45;cursor:not-allowed}
        footer{padding:0 14px 10px;color:#94a3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        @media(max-width:760px){.messageList article{max-width:96%}form{grid-template-columns:minmax(0,1fr) 42px;margin:0 7px 7px}.sendButton{width:42px;height:42px}.messageList p.userCollapsed{-webkit-line-clamp:6}.messageList p.assistantCollapsed{-webkit-line-clamp:12}}
      `}</style>
    </section>
  );
}
