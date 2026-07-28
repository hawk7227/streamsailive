"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BuilderChatConnection } from "./builderSystemContract";

type Message = { id?: string; role?: string; content?: string; status?: string };
type Props = { connection: BuilderChatConnection; onConnectionChange: (next: BuilderChatConnection) => void };

const COMPOSER_MIN_HEIGHT = 52;
const COMPOSER_MAX_HEIGHT = 224;
const USER_COLLAPSE_LINES = 7;
const ASSISTANT_COLLAPSE_LINES = 14;
const PREVIEW_PATH = /(?:https?:\/\/[^\s]+)?\/streams-builder\/preview\/[0-9a-f-]{20,}/gi;

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

function displayContent(message: Message) {
  const content = String(message.content || "");
  if (!PREVIEW_PATH.test(content)) return content;
  PREVIEW_PATH.lastIndex = 0;
  const cleaned = content.replace(PREVIEW_PATH, "").replace(/Your frontend preview is ready:?/gi, "").trim();
  return cleaned || "Your preview is ready in the Builder workspace.";
}

function messageNeedsCollapse(message: Message) {
  const content = displayContent(message);
  if (!content) return false;
  const explicitLines = content.split("\n").length;
  const estimatedWrappedLines = Math.ceil(content.length / 72);
  const threshold = message.role === "user" ? USER_COLLAPSE_LINES : ASSISTANT_COLLAPSE_LINES;
  return Math.max(explicitLines, estimatedWrappedLines) > threshold;
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const localStreaming = current.filter((item) => String(item.id || "").startsWith("local-") && item.status === "streaming");
  if (localStreaming.length) return current;
  const seen = new Set<string>();
  return incoming.filter((item, index) => {
    const key = item.id || `${item.role}:${item.content}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ActualBuilderSessionChat({ connection, onConnectionChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Loading conversation…");
  const [running, setRunning] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const answerRef = useRef("");
  const paintFrameRef = useRef<number | null>(null);

  const sessionId = connection.sessionId && connection.sessionId !== "agent-1" ? connection.sessionId : querySessionId();
  const visibleMessages = useMemo(() => messages.filter((message) => message.role === "user" || message.role === "assistant"), [messages]);

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
    if (!sessionId) { setStatus("No conversation session supplied."); return; }
    const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => null) as { ok?: boolean; messages?: Message[]; error?: string } | null;
    if (!response.ok || !payload?.ok) { setStatus(payload?.error || "Could not load the conversation."); return; }
    setMessages((current) => mergeMessages(current, Array.isArray(payload.messages) ? payload.messages : []));
    setStatus("Conversation connected.");
    onConnectionChange({ connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId });
  }

  function paintAnswer(assistantId: string, statusValue: string = "streaming") {
    if (paintFrameRef.current !== null) return;
    paintFrameRef.current = window.requestAnimationFrame(() => {
      paintFrameRef.current = null;
      const content = answerRef.current;
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content, status: statusValue } : item));
    });
  }

  useEffect(() => { void hydrate(); }, [sessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end", behavior: running ? "smooth" : "auto" }); }, [visibleMessages.length, running]);
  useEffect(() => { resizeComposer(); }, [prompt]);
  useEffect(() => () => { if (paintFrameRef.current !== null) window.cancelAnimationFrame(paintFrameRef.current); }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = prompt.trim();
    if (!clean || running || !sessionId) return;
    setPrompt("");
    window.requestAnimationFrame(resetComposer);
    setRunning(true);
    setStatus("Thinking…");
    const stamp = Date.now();
    const userId = `local-user-${stamp}`;
    const assistantId = `local-assistant-${stamp}`;
    answerRef.current = "";
    setMessages((items) => [...items, { id: userId, role: "user", content: clean, status: "complete" }, { id: assistantId, role: "assistant", content: "", status: "streaming" }]);
    try {
      const response = await fetch("/api/streams-ai/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sessionId, message: clean, runAssistant: true, idempotencyKey: `builder-session-${stamp}`, metadata: { source: "canonical-builder-session-chat", connectedWorkstation: "Primary Builder" } }),
      });
      if (!response.ok || !response.body) throw new Error((await response.text().catch(() => "")) || `Chat request failed: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
            answerRef.current += parsed.payload.token;
            paintAnswer(assistantId);
          }
          if (parsed.event === "activity") setStatus(String(parsed.payload.statusText || "Working…"));
          if (parsed.event === "error") throw new Error(String(parsed.payload.message || "StreamsAI could not complete the response."));
        }
      }
      if (paintFrameRef.current !== null) { window.cancelAnimationFrame(paintFrameRef.current); paintFrameRef.current = null; }
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: answerRef.current || "Completed.", status: "complete" } : item));
      setStatus(PREVIEW_PATH.test(answerRef.current) ? "Preview ready in Builder." : "Ready");
      PREVIEW_PATH.lastIndex = 0;
      window.setTimeout(() => void hydrate(), 900);
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
      <div className="messageList">
        {visibleMessages.map((message, index) => {
          const key = message.id || `${message.role}-${index}`;
          const collapsible = message.status !== "streaming" && messageNeedsCollapse(message);
          const expanded = Boolean(expandedMessages[key]);
          const content = displayContent(message);
          return <article key={key} className={message.role === "user" ? "user" : message.status === "failed" ? "assistant failed" : "assistant"}>
            <b>{message.role === "user" ? "You" : "StreamsAI"}</b>
            <p className={collapsible && !expanded ? (message.role === "user" ? "collapsed userCollapsed" : "collapsed assistantCollapsed") : ""}>{content || (message.status === "streaming" ? "Thinking…" : "")}</p>
            {collapsible ? <button type="button" className="messageToggle" aria-expanded={expanded} onClick={() => setExpandedMessages((items) => ({ ...items, [key]: !expanded }))}>{expanded ? "Show less" : "Show more"}</button> : null}
          </article>;
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send}>
        <textarea ref={composerRef} rows={2} value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask anything" disabled={running || !sessionId} />
        <div className="composerActions"><span>{status}</span><button className="sendButton" type="submit" disabled={running || !prompt.trim()}>↑</button></div>
      </form>
      <style jsx>{`
        .actualBuilderChat{height:100%;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:#030817;color:#e8eefc;border-right:1px solid rgba(56,189,248,.18);overflow:hidden}
        .messageList{min-height:0;overflow:auto;padding:20px 18px 30px;display:flex;flex-direction:column;gap:18px;scroll-behavior:smooth}.messageList article{max-width:92%;min-width:0;padding:2px 0;background:transparent;overflow:hidden}.messageList article.user{align-self:flex-end;border:1px solid rgba(148,163,184,.26);border-radius:18px;padding:12px 15px;background:#101a2f}.messageList article.assistant{align-self:flex-start}.messageList article.failed{color:#fecaca}.messageList b{font-size:10px;color:#7dd3fc}.messageList p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.58;color:#edf4ff}.messageList p.collapsed{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}.messageList p.userCollapsed{-webkit-line-clamp:${USER_COLLAPSE_LINES}}.messageList p.assistantCollapsed{-webkit-line-clamp:${ASSISTANT_COLLAPSE_LINES}}.messageToggle{margin-top:8px;padding:0;border:0;background:transparent;color:#7dd3fc;font-size:11px;font-weight:800;cursor:pointer}
        form{display:grid;grid-template-rows:auto 44px;gap:8px;margin:0 14px 12px;padding:12px 14px 10px;border:1px solid rgba(168,85,247,.44);border-radius:22px;background:#11152d;overflow:hidden}textarea{box-sizing:border-box;width:100%;min-height:${COMPOSER_MIN_HEIGHT}px;max-height:${COMPOSER_MAX_HEIGHT}px;resize:none;overflow-y:hidden;border:0;outline:0;background:transparent;color:#fff;font:14px/1.5 Inter,system-ui,sans-serif;padding:4px 2px;white-space:pre-wrap;overflow-wrap:anywhere;scrollbar-width:thin}.composerActions{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid rgba(148,163,184,.14);padding-top:8px}.composerActions span{min-width:0;color:#94a3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sendButton{width:42px;height:42px;border:0;border-radius:14px;background:linear-gradient(135deg,#9333ea,#22d3ee);color:#fff;font-size:21px;font-weight:900;cursor:pointer}.sendButton:disabled{opacity:.45;cursor:not-allowed}
        @media(max-width:760px){.messageList{padding:14px 10px 22px}.messageList article{max-width:96%}form{margin:0 7px 7px}.messageList p.userCollapsed{-webkit-line-clamp:6}.messageList p.assistantCollapsed{-webkit-line-clamp:12}}
      `}</style>
    </section>
  );
}