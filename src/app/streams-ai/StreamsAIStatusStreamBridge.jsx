"use client";

import { useEffect } from "react";

const STATUS_TEXTS = [
  "Preparing app tools",
  "Checking context",
  "Writing response",
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isStatusText(text) {
  const clean = normalizeText(text).replace(/^✦\s*/, "");
  return clean === "Thinking…" || clean === "Thinking..." || STATUS_TEXTS.includes(clean);
}

function latestStatusBubble() {
  const bubbles = Array.from(document.querySelectorAll(".chatPanel .msg.assistant .bubble"));
  for (let index = bubbles.length - 1; index >= 0; index -= 1) {
    const bubble = bubbles[index];
    if (isStatusText(bubble.textContent)) return bubble;
  }
  return null;
}

export default function StreamsAIStatusStreamBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const styleId = "streams-ai-live-status-style";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .streamsLiveStatusText {
        display: inline-block;
        background: linear-gradient(90deg, rgba(226,232,240,.42), rgba(255,255,255,.98), rgba(226,232,240,.42));
        background-size: 220% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent !important;
        animation: streamsStatusShimmer 1.25s ease-in-out infinite;
      }
      @keyframes streamsStatusShimmer {
        0% { background-position: 100% 50%; opacity: .58; }
        50% { background-position: 0% 50%; opacity: 1; }
        100% { background-position: -100% 50%; opacity: .72; }
      }
    `;
    document.head.appendChild(style);

    let index = 0;
    let frame = 0;

    const renderStatus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bubble = latestStatusBubble();
        if (!bubble) return;
        const current = normalizeText(bubble.textContent).replace(/^✦\s*/, "");
        if (!isStatusText(current)) return;
        const next = STATUS_TEXTS[index % STATUS_TEXTS.length];
        index += 1;
        bubble.innerHTML = `<span class="streamsLiveStatusText">${next}</span>`;
      });
    };

    renderStatus();
    const timer = window.setInterval(renderStatus, 1450);
    const observer = new MutationObserver(renderStatus);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      observer.disconnect();
      style.remove();
    };
  }, []);

  return null;
}
