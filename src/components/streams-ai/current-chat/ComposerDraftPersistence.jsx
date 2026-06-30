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

function findComposerInput() {
  return document.querySelector(".streamsComposerInput");
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function readDraft(threadId) {
  try {
    return window.localStorage.getItem(draftKey(threadId)) || "";
  } catch {
    return "";
  }
}

function writeDraft(threadId, value) {
  try {
    const key = draftKey(threadId);
    const text = String(value || "");
    if (text.trim()) window.localStorage.setItem(key, text);
    else window.localStorage.removeItem(key);
  } catch {
    // Local-only convenience feature; ignore storage failures.
  }
}

export default function ComposerDraftPersistence({ chatRuntime }) {
  const activeThreadRef = useRef("new");
  const lastRestoredRef = useRef("");

  useEffect(() => {
    function restoreDraft(force = false) {
      const input = findComposerInput();
      if (!input) return;
      const threadId = currentThreadId(chatRuntime);
      activeThreadRef.current = threadId;
      const saved = readDraft(threadId);
      if (!force && lastRestoredRef.current === `${threadId}:${saved}`) return;
      if (saved && !String(input.value || "").trim()) {
        setNativeInputValue(input, saved);
        lastRestoredRef.current = `${threadId}:${saved}`;
      }
    }

    const timer = window.setTimeout(() => restoreDraft(true), 250);
    const interval = window.setInterval(() => restoreDraft(false), 1200);
    window.addEventListener("popstate", () => restoreDraft(true));
    window.addEventListener("streams:recent-chats-refresh", () => restoreDraft(true));
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [chatRuntime?.sessionId]);

  useEffect(() => {
    function onInput(event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.classList.contains("streamsComposerInput")) return;
      writeDraft(activeThreadRef.current || currentThreadId(chatRuntime), input.value);
    }

    function clearAfterSend() {
      const input = findComposerInput();
      const value = String(input?.value || "");
      if (!value.trim()) return;
      const threadId = activeThreadRef.current || currentThreadId(chatRuntime);
      window.setTimeout(() => {
        writeDraft(threadId, "");
        window.dispatchEvent(new Event("streams:recent-chats-refresh"));
      }, 600);
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

    window.addEventListener("input", onInput, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("input", onInput, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [chatRuntime?.sessionId]);

  return null;
}
