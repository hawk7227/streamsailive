"use client";

import { useEffect } from "react";

const STATE_KEY = "streams-ai:conversation-state";
const CHANNEL_NAME = "streams-ai:conversation-state";
const STYLE_ID = "streams-ai-real-brain-state";

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
  const nextValue = speaking ? "true" : "false";
  const nextLabel = speaking ? "A.S.K. AI is speaking." : "A.S.K. AI is listening.";
  const nextStatus = speaking ? "A.S.K. IS SPEAKING" : "A.S.K. IS LISTENING";

  if (orb.dataset.realSpeaking !== nextValue) orb.dataset.realSpeaking = nextValue;
  if (orb.getAttribute("aria-pressed") !== nextValue) orb.setAttribute("aria-pressed", nextValue);
  if (orb.getAttribute("aria-label") !== nextLabel) orb.setAttribute("aria-label", nextLabel);

  const status = orb.querySelector('[class*="orbStatus"]');
  if (status && status.textContent !== nextStatus) status.textContent = nextStatus;
}

function installStateStyles() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes streamsRealBrainPulse {
      0%,100% { transform: scale(1); filter: saturate(1) brightness(1); }
      45% { transform: scale(1.045); filter: saturate(1.18) brightness(1.12); }
      70% { transform: scale(1.018); filter: saturate(1.08) brightness(1.06); }
    }
    @keyframes streamsRealVoiceBar {
      from { height: 6px; opacity: .62; }
      to { height: 31px; opacity: 1; }
    }
    button[data-real-speaking="false"] [class*="voiceBars"] {
      opacity: 0 !important;
    }
    button[data-real-speaking="false"] [class*="orb_"] {
      animation: none !important;
      transform: scale(1) !important;
      filter: saturate(1) brightness(1) !important;
    }
    button[data-real-speaking="false"] [class*="brainGraphic"] {
      animation: none !important;
      transform: translateY(0) scale(1) !important;
    }
    button[data-real-speaking="true"] [class*="orb_"] {
      animation: streamsRealBrainPulse 1.05s ease-in-out infinite !important;
      box-shadow: 0 0 38px rgba(47,164,255,.82), 0 0 105px rgba(122,57,255,.64), inset 0 0 54px rgba(90,217,255,.34) !important;
    }
    button[data-real-speaking="true"] [class*="brainGraphic"] {
      animation: streamsRealBrainPulse .78s ease-in-out infinite !important;
    }
    button[data-real-speaking="true"] [class*="voiceBars"] {
      opacity: 1 !important;
    }
    button[data-real-speaking="true"] [class*="voiceBars"] i {
      animation: streamsRealVoiceBar .68s ease-in-out infinite alternate !important;
    }
  `;
  document.head.appendChild(style);
  return style;
}

export default function LandingBrainRuntimeBridge() {
  useEffect(() => {
    let currentState = readStoredState();
    let channel;
    const style = installStateStyles();

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
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      observer.disconnect();
      style.remove();
      channel?.close?.();
      window.removeEventListener("streams-ai:conversation-state", onConversationState);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
