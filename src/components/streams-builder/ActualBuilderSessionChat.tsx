"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { BuilderChatConnection } from "./builderSystemContract";

type Message = { id?: string; role?: string; content?: string; status?: string };
type Props = { connection: BuilderChatConnection; onConnectionChange: (next: BuilderChatConnection) => void };

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

export default function ActualBuilderSessionChat({ connection, onConnectionChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Loading originating StreamsAI conversation…");
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sessionId = connection.sessionId && connection.sessionId !== "agent-1" ? connection.sessionId : querySessionId();

  async function hydrate() {
    if (!sessionId) { setStatus("No originating StreamsAI session was supplied."); return; }
    const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => null) as { ok?: boolean; messages?: Message[]; error?: string } | null;
    if (!response.ok || !payload?.ok) { setStatus(payload?.error || "Could not load the originating conversation."); return; }
    setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    setStatus("Actual StreamsAI conversation connected.");
    onConnectionChange({ connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId });
  }

  useEffect(() => { void hydrate(); }, [sessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = prompt.trim();
    if (!clean || running || !sessionId) return;
    setPrompt("");
    setRunning(true);
    setStatus("StreamsAI is working in the Builder session…");
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
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "chat.response.complete", message: "Originating StreamsAI session completed a Builder response." } }));
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
      <header><b>StreamsAI Session</b><span>{sessionId || "not connected"}</span></header>
      <div className="messageList">
        {messages.map((message, index) => <article key={message.id || `${message.role}-${index}`} className={message.role === "user" ? "user" : message.status === "failed" ? "assistant failed" : "assistant"}><b>{message.role === "user" ? "You" : "StreamsAI"}</b><p>{message.content || (message.status === "streaming" ? "Thinking…" : "")}</p></article>)}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send}><textarea value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} placeholder="Continue the same Builder conversation" disabled={running || !sessionId} /><button type="submit" disabled={running || !prompt.trim()}>↑</button></form>
      <footer>{status}</footer>
      <style jsx>{`
        .actualBuilderChat{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;background:#030817;color:#e8eefc;border-right:1px solid rgba(56,189,248,.18)}
        header{height:48px;display:flex;flex-direction:column;justify-content:center;padding:0 14px;border-bottom:1px solid rgba(148,163,184,.16);background:#071124} header b{font-size:13px} header span{font:10px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;color:#7dd3fc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .messageList{min-height:0;overflow:auto;padding:14px 12px 24px;display:flex;flex-direction:column;gap:12px}.messageList article{max-width:92%;border:1px solid rgba(148,163,184,.18);border-radius:14px;padding:10px 12px;background:#0b152a}.messageList article.user{align-self:flex-end;background:#2b1450;border-color:rgba(168,85,247,.42)}.messageList article.assistant{align-self:flex-start}.messageList article.failed{border-color:#ef4444}.messageList b{font-size:10px;color:#7dd3fc}.messageList p{margin:4px 0 0;white-space:pre-wrap;font-size:12px;line-height:1.45;color:#edf4ff}
        form{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;margin:0 10px 8px;padding:8px;border:1px solid rgba(168,85,247,.44);border-radius:18px;background:#241044}textarea{min-height:44px;max-height:130px;resize:vertical;border:0;outline:0;background:transparent;color:#fff;font:12px/1.4 Inter,system-ui,sans-serif;padding:8px}button{width:44px;height:44px;border:0;border-radius:14px;background:linear-gradient(135deg,#9333ea,#22d3ee);color:white;font-size:22px;font-weight:900}button:disabled{opacity:.45}
        footer{padding:0 14px 10px;color:#94a3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      `}</style>
    </section>
  );
}
