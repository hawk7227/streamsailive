"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { VisionsMessage, VisionsMode, VisionsPreviewSpec } from "@/lib/streams-visions/types";
import styles from "./visions.module.css";

const STORAGE = {
  conversation: "streams-visions.conversation.v1",
  mode: "streams-visions.mode.v1",
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeMessage(input: any): VisionsMessage {
  return {
    id: String(input.id || crypto.randomUUID()),
    role: input.role === "assistant" ? "assistant" : "user",
    content: String(input.content || ""),
    createdAt: String(input.created_at || input.createdAt || nowIso()),
  };
}

function VisionPreview({ preview, revealing, onClose }: { preview: VisionsPreviewSpec; revealing: boolean; onClose: () => void }) {
  return (
    <section className={`${styles.previewShell} ${revealing ? styles.revealing : styles.ready}`} aria-label="Streams Visions live preview">
      <header className={styles.previewHeader}>
        <div><span className={styles.liveDot} /> {revealing ? "Visual coming into view" : "Vision ready"}</div>
        <button type="button" onClick={onClose} aria-label="Close visual">×</button>
      </header>
      <div className={styles.previewCanvas} style={{ "--vision-accent": preview.accent } as React.CSSProperties}>
        <nav className={styles.previewNav}><strong>{preview.title}</strong><span>Overview &nbsp; Features &nbsp; Contact</span></nav>
        <div className={styles.previewHero}>
          <div>
            <p className={styles.previewEyebrow}>{preview.eyebrow}</p>
            <h2>{preview.headline}</h2>
            <p>{preview.subheadline}</p>
            <div className={styles.previewActions}><button>{preview.primaryCta}</button><button>{preview.secondaryCta}</button></div>
          </div>
          <div className={styles.previewOrb}><span /><span /><span /></div>
        </div>
        <div className={styles.previewFeatures}>
          {preview.sections.slice(0, 3).map((section) => <article key={section.title}><strong>{section.title}</strong><p>{section.body}</p></article>)}
        </div>
      </div>
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
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(STORAGE.mode) as VisionsMode | null;
    if (savedMode === "off" || savedMode === "ask_first" || savedMode === "automatic") setMode(savedMode);
    const savedConversation = window.localStorage.getItem(STORAGE.conversation);
    if (savedConversation) void restoreConversation(savedConversation);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.mode, mode);
  }, [mode]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, preview, busy]);

  async function restoreConversation(id: string) {
    const response = await fetch(`/api/streams-ai/Visions/messages?conversationId=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json();
    setConversationId(id);
    setMessages((data.messages || []).map(normalizeMessage));
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const response = await fetch("/api/streams-ai/Visions/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ title: "New vision", mode }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to start Visions");
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

    try {
      const id = await ensureConversation();
      const response = await fetch("/api/streams-ai/Visions/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ conversationId: id, content, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Visions could not complete that request");
      setMessages((current) => [...current.filter((message) => message.id !== optimistic.id), normalizeMessage(data.userMessage), normalizeMessage(data.message)]);
      if (data.preview) {
        setPreview(data.preview);
        setRevealing(true);
        window.dispatchEvent(new CustomEvent("visions:preview-revealing", { detail: { previewId: data.preview.id } }));
        window.setTimeout(() => {
          setRevealing(false);
          window.dispatchEvent(new CustomEvent("visions:preview-ready", { detail: { previewId: data.preview.id } }));
        }, 2600);
      }
    } catch (caught: any) {
      if (caught?.name !== "AbortError") setError(caught?.message || "Visions encountered an error");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setBusy(false);
  }

  function newVision() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setPreview(null);
    setError("");
    window.localStorage.removeItem(STORAGE.conversation);
  }

  const welcome = useMemo(() => messages.length === 0, [messages.length]);

  return (
    <main data-streams-visions-root className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.mark}>✦</span><div><strong>Streams Visions</strong><small>Visual conversation</small></div></div>
        <div className={styles.topActions}>
          <label><span>Visuals</span><select value={mode} onChange={(event) => setMode(event.target.value as VisionsMode)}><option value="off">Off</option><option value="ask_first">Ask first</option><option value="automatic">Automatic</option></select></label>
          <button type="button" onClick={newVision}>New</button>
        </div>
      </header>

      <div ref={feedRef} className={styles.feed}>
        {welcome && <section className={styles.welcome}><span className={styles.visionIcon}>✦</span><h1>Turn what you’re imagining into something you can see.</h1><p>Chat normally. When an idea benefits from a visual, it can appear here in the conversation like a vision coming into view.</p><div className={styles.suggestions}>{["Visualize my business idea", "Show a landing page concept", "Help me imagine the customer experience"].map((text) => <button key={text} type="button" onClick={() => setInput(text)}>{text}</button>)}</div></section>}

        {messages.map((message) => <article key={message.id} className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}><div className={styles.avatar}>{message.role === "user" ? "You" : "✦"}</div><div><strong>{message.role === "user" ? "You" : "Streams Visions"}</strong><p>{message.content}</p></div></article>)}

        {preview && <VisionPreview preview={preview} revealing={revealing} onClose={() => setPreview(null)} />}
        {busy && <div className={styles.generating}><span /><span /><span /> Thinking and shaping the visual…</div>}
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe what you’re imagining…" rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        {busy ? <button type="button" onClick={cancel} aria-label="Stop generation">■</button> : <button type="submit" disabled={!input.trim()} aria-label="Send message">↑</button>}
      </form>
    </main>
  );
}
