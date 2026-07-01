"use client";

import { useEffect, useRef } from "react";

const DRAFT_PREFIX = "streams-ai:composer-draft:";

function currentThreadId(chatRuntime) {
  if (chatRuntime?.sessionId) return String(chatRuntime.sessionId);
  if (typeof window === "undefined") return "new";
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "streams-ai" && parts[1]) return parts[1];
  return "new";
}

function draftKey(threadId) {
  return `${DRAFT_PREFIX}${threadId || "new"}`;
}

function emitDraftState(detail) {
  const payload = {
    phase: "composer-draft-state",
    source: "streams-composer-draft",
    message: `Composer draft state: ${detail.hasDraft ? `${detail.draftLength} chars` : "empty"} for ${detail.sessionId || "new"}.`,
    ...detail,
    at: new Date().toISOString(),
  };
  try { window.localStorage.setItem("streams-ai:composer-draft-state", JSON.stringify(payload)); } catch {}
  window.dispatchEvent(new CustomEvent("streams-ai:composer-draft-state", { detail: payload }));
  try { window.parent?.postMessage({ type: "streams-ai:composer-draft-state", detail: payload, source: "streams-ai-chat-frame", at: payload.at }, window.location.origin); } catch {}
}

function findComposerInput() {
  return document.querySelector(".streamsComposerInput");
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function readLocalDraft(threadId) {
  try {
    return window.localStorage.getItem(draftKey(threadId)) || "";
  } catch {
    return "";
  }
}

function writeLocalDraft(threadId, value) {
  try {
    const key = draftKey(threadId);
    const text = String(value || "");
    if (text.trim()) window.localStorage.setItem(key, text);
    else window.localStorage.removeItem(key);
  } catch {
    // Local fallback only.
  }
}

async function readServerDraft(threadId) {
  const response = await fetch(`/api/streams-ai/drafts?sessionId=${encodeURIComponent(threadId || "new")}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Draft read failed");
  return String(data.draft || "");
}

async function writeServerDraft(threadId, draft) {
  const response = await fetch("/api/streams-ai/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: threadId || "new", draft }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Draft save failed");
  return data;
}

export default function ComposerDraftPersistence({ chatRuntime }) {
  const activeThreadRef = useRef("new");
  const lastRestoredRef = useRef("");
  const saveTimerRef = useRef(0);
  const pendingDraftRef = useRef("");
  const submittedClearUntilRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function restoreDraft(force = false) {
      if (Date.now() < submittedClearUntilRef.current) return;
      const input = findComposerInput();
      if (!input) return;
      const threadId = currentThreadId(chatRuntime);
      activeThreadRef.current = threadId;
      const localSaved = readLocalDraft(threadId);
      let serverSaved = "";
      try { serverSaved = await readServerDraft(threadId); } catch {}
      if (cancelled) return;
      const saved = serverSaved || localSaved;
      emitDraftState({ sessionId: threadId, hasDraft: Boolean(saved), draftLength: String(saved || "").length, savedLocal: Boolean(localSaved), savedServer: Boolean(serverSaved), restored: Boolean(saved) });
      if (!force && lastRestoredRef.current === `${threadId}:${saved}`) return;
      if (saved && !String(input.value || "").trim()) {
        setNativeInputValue(input, saved);
        writeLocalDraft(threadId, saved);
        lastRestoredRef.current = `${threadId}:${saved}`;
      }
    }

    const timer = window.setTimeout(() => restoreDraft(true), 250);
    const interval = window.setInterval(() => restoreDraft(false), 2400);
    const restore = () => restoreDraft(true);
    window.addEventListener("popstate", restore);
    window.addEventListener("streams:recent-chats-refresh", restore);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("streams:recent-chats-refresh", restore);
    };
  }, [chatRuntime?.sessionId]);

  useEffect(() => {
    function clearDraftNow(reason = "submitted") {
      const threadId = activeThreadRef.current || currentThreadId(chatRuntime);
      pendingDraftRef.current = "";
      submittedClearUntilRef.current = Date.now() + 2200;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      writeLocalDraft(threadId, "");
      writeServerDraft(threadId, "").catch(() => {});
      const input = findComposerInput();
      if (input && String(input.value || "")) setNativeInputValue(input, "");
      lastRestoredRef.current = `${threadId}:`;
      emitDraftState({ sessionId: threadId, hasDraft: false, draftLength: 0, savedLocal: true, savedServer: true, clearedAfterSend: true, reason });
      window.dispatchEvent(new Event("streams:recent-chats-refresh"));
    }

    function scheduleServerSave(threadId, value) {
      pendingDraftRef.current = String(value || "");
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        writeServerDraft(threadId, pendingDraftRef.current).then(() => emitDraftState({ sessionId: threadId, hasDraft: Boolean(pendingDraftRef.current.trim()), draftLength: pendingDraftRef.current.length, savedLocal: true, savedServer: true })).catch(() => {});
      }, 650);
    }

    function onInput(event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.classList.contains("streamsComposerInput")) return;
      const threadId = activeThreadRef.current || currentThreadId(chatRuntime);
      writeLocalDraft(threadId, input.value);
      emitDraftState({ sessionId: threadId, hasDraft: Boolean(input.value.trim()), draftLength: String(input.value || "").length, savedLocal: true, savedServer: false });
      scheduleServerSave(threadId, input.value);
    }

    function clearAfterSend() {
      const input = findComposerInput();
      const value = String(input?.value || "");
      if (!value.trim()) return;
      window.setTimeout(() => clearDraftNow("send-control"), 0);
    }

    function onClick(event) {
      const button = event.target?.closest?.(".streamsComposerSendButton");
      if (button) clearAfterSend();
    }

    function onKeyDown(event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.classList.contains("streamsComposerInput")) return;
      if (event.key === "Enter" && !event.shiftKey) clearAfterSend();
    }

    function onComposerSubmitted() {
      clearDraftNow("composer-submitted");
    }

    window.addEventListener("input", onInput, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("streams:composer-submitted", onComposerSubmitted);
    return () => {
      window.removeEventListener("input", onInput, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("streams:composer-submitted", onComposerSubmitted);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [chatRuntime?.sessionId]);

  return null;
}
