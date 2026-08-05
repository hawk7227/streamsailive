"use client";

import { useEffect } from "react";

const STATE_KEY = "streams-ai:conversation-state";
const CHANNEL_NAME = "streams-ai:conversation-state";

function readStoredState() {
  try {
    return JSON.parse(window.localStorage.getItem(STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function findBrainOrb() {
  return document.querySelector('button[aria-label*="A.S.K. AI"]');
}

function applyState(detail) {
  const orb = findBrainOrb();
  if (!orb) return;
  const speaking = Boolean(detail?.isStreaming);
  orb.dataset.realSpeaking = speaking ? "true" : "false";
  orb.setAttribute("aria-pressed", speaking ? "true" : "false");
  orb.setAttribute(
    "aria-label",
    speaking ? "A.S.K. AI is speaking." : "A.S.K. AI is listening."
  );
  const status = orb.querySelector('[class*="orbStatus"]');
  if (status) status.textContent = speaking ? "A.S.K. IS SPEAKING" : "A.S.K. IS LISTENING";
}

export default function LandingBrainRuntimeBridge() {
  useEffect(() => {
    let currentState = readStoredState();
    let channel;

    const sync = (detail = currentState) => {
      if (detail) currentState = detail;
      applyState(currentState);
    };

    const onConversationState = (event) => sync(event?.detail);
    const onStorage = (event) => {
      if (event.key !== STATE_KEY) return;
      try { sync(JSON.parse(event.newValue || "null")); } catch {}
    };

    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => sync(event.data);
    } catch {}

    window.addEventListener("streams-ai:conversation-state", onConversationState);
    window.addEventListener("storage", onStorage);

    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    sync();

    return () => {
      observer.disconnect();
      channel?.close?.();
      window.removeEventListener("streams-ai:conversation-state", onConversationState);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
