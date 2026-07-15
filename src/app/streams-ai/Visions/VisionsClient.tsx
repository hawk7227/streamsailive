"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { VisionsMessage, VisionsMode, VisionsPreviewSpec } from "@/lib/streams-visions/types";
import styles from "./visions.module.css";

const STORAGE = {
  conversation: "streams-visions.conversation.v1",
  mode: "streams-visions.mode.v1",
};

type MessagePayload = Partial<VisionsMessage> & { created_at?: string };
type ApiPayload = Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function normalizeMessage(input: MessagePayload): VisionsMessage {
  return {
    id: String(input.id || crypto.randomUUID()),
    role: input.role === "assistant" ? "assistant" : "user",
    content: String(input.content || ""),
    createdAt: String(input.created_at || input.createdAt || nowIso()),
  };
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : "Visions encountered an error";
}

function VisionPreview({ preview, revealing, onClose }: { preview: VisionsPreviewSpec; revealing: boolean; onClose: () => void }) {
  const revealStyle = { "--vision-accent": preview.accent, "--vision-reveal-ms": `${preview.revealMs}ms` } as CSSProperties;
  return (
    <section className={`${styles.vision} ${revealing ? styles.revealing : styles.ready}`} style={revealStyle} aria-label="A future vision formed from the conversation">
      <div className={styles.visionAtmosphere} aria-hidden="true"><span /><span /><span /></div>
      <div className={styles.visionWorld}>
        <div className={styles.visionSky} aria-hidden="true" />
        <div className={styles.visionScene}>
          <p className={styles.visionEyebrow}>{preview.eyebrow}</p>
          <h2>{preview.headline}</h2>
          <p className={styles.visionSubheadline}>{preview.subheadline}</p>
          <div className={styles.futureSelf}>
            <span className={styles.futureSelfGlow} aria-hidden="true" />
            <div><strong>You, inside the future</strong><p>{preview.futureSelf}</p></div>
          </div>
          <div className={styles.visionDetails}>
            <article><strong>The place</strong><p>{preview.environment}</p></article>
            <article><strong>The feeling</strong><p>{preview.emotionalOutcome}</p></article>
          </div>
          <div className={styles.visionMilestones}>
            {preview.sections.slice(0, 3).map((section) => <article key={section.title}><strong>{section.title}</strong><p>{section.body}</p></article>)}
          </div>
        </div>
      </div>
      {!revealing && <div className={styles.visionControls}>
        <button type="button">Enter vision</button>
        <button type="button">Continue this vision</button>
        <button type="button" onClick={onClose} aria-label="Close vision">Close</button>
      </div>}
    </section>
  );
}

export default function VisionsClient() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VisionsMessage[]>([]);
  const [mode, setMode] = useState<VisionsMode>("ask_first");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<VisionsPreviewSpec | null>(null);
  const [revealing, setRevealing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const restoreConversation = useCallback(async (id: string) => {
    const response = await fetch(`/api/streams-ai/Visions/messages?conversationId=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json() as { messages?: MessagePayload[]; preview?: VisionsPreviewSpec | null; mode?: VisionsMode };
    setConversationId(id);
    setMessages((data.messages || []).map(normalizeMessage));
    setPreview(data.preview || null);
    if (data.mode === "off" || data.mode === "ask_first" || data.mode === "automatic") setMode(data.mode);
  }, []);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(STORAGE.mode) as VisionsMode | null;
    if (savedMode === "off" || savedMode === "ask_first" || savedMode === "automatic") setMode(savedMode);
    const savedConversation = window.localStorage.getItem(STORAGE.conversation);
    if (savedConversation) void restoreConversation(savedConversation);
    return () => { if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current); };
  }, [restoreConversation]);

  useEffect(() => { window.localStorage.setItem(STORAGE.mode, mode); }, [mode]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 180;
    if (nearBottom) feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [messages, preview, busy]);

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const response = await fetch("/api/streams-ai/Visions/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ title: "New vision", mode }),
    });
    const data = await response.json() as { conversation?: { id?: string }; error?: string };
    if (!response.ok || !data.conversation?.id) throw new Error(data.error || "Unable to start Visions");
    const id = String(data.conversation.id);
    setConversationId(id);
    window.localStorage.setItem(STORAGE.conversation, id);
    return id;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    setError("");
    setInput("");
    setBusy(true);
    const optimistic = normalizeMessage({ role: "user", content });
    setMessages((current) => [...current, optimistic]);
    const controller = new AbortController();
    abortRef.current = controller;
    window.dispatchEvent(new CustomEvent("visions:message-started"));

    try {
      const id = await ensureConversation();
      const response = await fetch("/api/streams-ai/Visions/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ conversationId: id, content, mode }),
      });
      const data = await response.json() as ApiPayload;
      if (!response.ok) throw new Error(String(data.error || "Visions could not complete that request"));
      const userMessage = normalizeMessage((data.userMessage || {}) as MessagePayload);
      const assistantMessage = normalizeMessage((data.message || {}) as MessagePayload);
      setMessages((current) => [...current.filter((message) => message.id !== optimistic.id), userMessage, assistantMessage]);
      window.dispatchEvent(new CustomEvent("visions:message-complete", { detail: { conversationId: id } }));
      if (data.preview && typeof data.preview === "object") {
        const nextPreview = data.preview as VisionsPreviewSpec;
        setPreview(nextPreview);
        setRevealing(true);
        window.dispatchEvent(new CustomEvent("visions:preview-revealing", { detail: { previewId: nextPreview.id } }));
        if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = window.setTimeout(() => {
          setRevealing(false);
          window.dispatchEvent(new CustomEvent("visions:preview-ready", { detail: { previewId: nextPreview.id } }));
        }, nextPreview.revealMs || 5200);
      }
    } catch (caught: unknown) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(errorMessage(caught));
        window.dispatchEvent(new CustomEvent("visions:preview-failed"));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setBusy(false);
    window.dispatchEvent(new CustomEvent("visions:preview-cancelled"));
  }

  function newVision() {
    abortRef.current?.abort();
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    setConversationId(null);
    setMessages([]);
    setPreview(null);
    setError("");
    window.localStorage.removeItem(STORAGE.conversation);
  }

  const welcome = messages.length === 0;

  return (
    <main data-streams-visions-root className={`${styles.root} ${busy ? styles.gathering : ""}`}>
      <div className={styles.ambientDream} aria-hidden="true"><span /><span /><span /></div>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.mark}>✦</span><div><strong>Streams Visions</strong><small>Visual conversation</small></div></div>
        <div className={styles.topActions}>
          <label><span>Visuals</span><select value={mode} onChange={(event) => setMode(event.target.value as VisionsMode)}><option value="off">Off</option><option value="ask_first">Ask first</option><option value="automatic">Automatic</option></select></label>
          <button type="button" onClick={newVision}>New</button>
        </div>
      </header>

      <div ref={feedRef} className={styles.feed}>
        {welcome && <section className={styles.welcome}><span className={styles.visionIcon}>✦</span><h1>Turn what you’re imagining into something you can see.</h1><p>Chat normally. When an idea carries a future worth seeing, it can quietly appear here like a vision coming into view.</p><div className={styles.suggestions}>{["Visualize my business idea", "Show me the future I’m building", "Help me imagine what success feels like"].map((text) => <button key={text} type="button" onClick={() => setInput(text)}>{text}</button>)}</div></section>}
        {messages.map((message) => <article key={message.id} className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}><div className={styles.avatar}>{message.role === "user" ? "You" : "✦"}</div><div><strong>{message.role === "user" ? "You" : "Streams Visions"}</strong><p>{message.content}</p></div></article>)}
        {preview && <VisionPreview preview={preview} revealing={revealing} onClose={() => setPreview(null)} />}
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe what you’re imagining…" rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        {busy ? <button type="button" onClick={cancel} aria-label="Stop">■</button> : <button type="submit" disabled={!input.trim()} aria-label="Send message">↑</button>}
      </form>
    </main>
  );
}
