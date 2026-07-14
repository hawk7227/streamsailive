"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./message-actions.css";

function actionId(action, messageId) {
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${action}:${messageId}:${random}`;
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const dateLabel = date.toDateString() === now.toDateString()
    ? "Today"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  return `${dateLabel}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

async function postAction(payload) {
  const response = await fetch("/api/streams-ai/message-actions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || "Message action failed");
    error.code = data?.code || "MESSAGE_ACTION_FAILED";
    throw error;
  }
  return data;
}

function IconButton({ label, children, onClick, selected = false, disabled = false }) {
  return <button type="button" className={selected ? "messageAction selected" : "messageAction"} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

export default function MessageActions({ message, chatRuntime }) {
  const messageId = String(message?.id || "");
  const sessionId = String(chatRuntime?.sessionId || "");
  const text = String(message?.content || message?.text || "");
  const persisted = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(messageId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const menuRef = useRef(null);
  const operationRef = useRef(new Map());

  const timestamp = useMemo(() => formatTimestamp(message?.createdAt || message?.created_at), [message?.createdAt, message?.created_at]);

  useEffect(() => {
    if (!persisted || !sessionId) return;
    let cancelled = false;
    const params = new URLSearchParams({ messageId, sessionId });
    fetch(`/api/streams-ai/message-actions?${params.toString()}`, { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (!cancelled && data?.ok) setFeedback(data.rating ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [messageId, persisted, sessionId]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeEscape);
    };
  }, [menuOpen]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const transient = (value) => {
    setStatus(value);
    window.setTimeout(() => setStatus(""), 1600);
  };

  const log = async (action, metadata = {}) => {
    if (!persisted || !sessionId) return;
    await postAction({ action, sessionId, messageId, content: text, idempotencyKey: actionId(action, messageId), metadata });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    transient("Copied");
    await log("copied").catch(() => {});
  };

  const updateFeedback = async (next) => {
    if (!persisted || busy) return;
    setBusy("feedback");
    const action = feedback === next ? "feedback_cleared" : next === 1 ? "feedback_up" : "feedback_down";
    const optimistic = feedback === next ? null : next;
    const prior = feedback;
    setFeedback(optimistic);
    try {
      const data = await postAction({ action, sessionId, messageId, content: text, idempotencyKey: actionId(action, messageId) });
      setFeedback(data.rating ?? optimistic);
    } catch {
      setFeedback(prior);
      transient("Feedback was not saved");
    } finally {
      setBusy("");
    }
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Streams response", text });
      else await navigator.clipboard.writeText(text);
      transient(navigator.share ? "Shared" : "Copied for sharing");
      await log("shared").catch(() => {});
    } catch (error) {
      if (error?.name !== "AbortError") transient("Share did not complete");
    }
  };

  const regenerate = async () => {
    if (!persisted || busy) return;
    setBusy("regenerate");
    setStatus("Regenerating…");
    const key = actionId("regenerate", messageId);
    operationRef.current.set("regenerate", key);
    try {
      await postAction({ action: "regenerate", sessionId, messageId, content: text, idempotencyKey: key });
      await chatRuntime?.refreshMessages?.();
      window.dispatchEvent(new Event("streams:chat-refresh-requested"));
      transient("New response ready");
    } catch {
      transient("Regeneration did not complete");
    } finally {
      operationRef.current.delete("regenerate");
      setBusy("");
    }
  };

  const branch = async () => {
    if (!persisted || busy) return;
    setBusy("branch");
    setStatus("Creating branch…");
    try {
      const data = await postAction({ action: "branch", sessionId, messageId, content: text, idempotencyKey: actionId("branch", messageId) });
      window.location.assign(data.href || `/streams-ai/${data.sessionId}`);
    } catch {
      transient("Branch could not be created");
      setBusy("");
    }
  };

  const readAloud = async () => {
    setMenuOpen(false);
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      transient("Read aloud is unavailable");
      await log("read_aloud_unavailable").catch(() => {});
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setStatus("");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, " Code block omitted. "));
    utterance.onstart = () => { setSpeaking(true); setStatus("Reading aloud…"); log("read_aloud_started").catch(() => {}); };
    utterance.onend = () => { setSpeaking(false); setStatus(""); log("read_aloud_completed").catch(() => {}); };
    utterance.onerror = () => { setSpeaking(false); transient("Read aloud stopped"); log("read_aloud_failed").catch(() => {}); };
    window.speechSynthesis.speak(utterance);
  };

  if (!text || message?.isStreaming || message?.status === "streaming") return null;

  return (
    <div className="messageActions" aria-label="Response actions">
      <IconButton label="Copy response" onClick={copy}>⧉</IconButton>
      <IconButton label="Good response" selected={feedback === 1} disabled={!persisted || busy === "feedback"} onClick={() => updateFeedback(1)}>♡</IconButton>
      <IconButton label="Bad response" selected={feedback === -1} disabled={!persisted || busy === "feedback"} onClick={() => updateFeedback(-1)}>♧</IconButton>
      <IconButton label="Share response" onClick={share}>↗</IconButton>
      <IconButton label="Regenerate response" disabled={!persisted || Boolean(busy)} onClick={regenerate}>↻</IconButton>
      <div className="messageMore" ref={menuRef}>
        <IconButton label="More response actions" disabled={!persisted} onClick={async () => {
          const next = !menuOpen;
          setMenuOpen(next);
          if (next) await log("more_menu_opened").catch(() => {});
        }}>•••</IconButton>
        {menuOpen ? <div className="messageMoreMenu" role="menu">
          {timestamp ? <div className="messageTimestamp">{timestamp}</div> : null}
          <button type="button" role="menuitem" onClick={branch} disabled={Boolean(busy)}>Branch in new chat</button>
          <button type="button" role="menuitem" onClick={readAloud}>{speaking ? "Stop reading" : "Read aloud"}</button>
        </div> : null}
      </div>
      {status ? <span className="messageActionStatus" role="status" aria-live="polite">{status}</span> : null}
    </div>
  );
}
