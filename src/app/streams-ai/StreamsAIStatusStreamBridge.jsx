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

function statusTextFromBubble(bubble) {
  return normalizeText(bubble?.textContent || "").replace(/^✦\s*/, "");
}

function isStatusText(text) {
  const clean = normalizeText(text).replace(/^✦\s*/, "");
  return clean === "Thinking…" || clean === "Thinking..." || STATUS_TEXTS.includes(clean);
}

function statusBubbles() {
  return Array.from(document.querySelectorAll(".chatPanel .msg.assistant .bubble")).filter((bubble) => isStatusText(statusTextFromBubble(bubble)));
}

function escapeText(text) {
  return String(text || "").replace(/[&<>"']/g, (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[match]));
}

export default function StreamsAIStatusStreamBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const styleId = "streams-ai-live-status-style";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .streamsLiveStatusBubble,
      .streamsLiveStatusText {
        display: inline-block !important;
        width: fit-content !important;
        background-image: linear-gradient(90deg, rgba(226,232,240,.35) 0%, rgba(255,255,255,1) 48%, rgba(226,232,240,.35) 100%) !important;
        background-size: 240% 100% !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        color: transparent !important;
        animation: streamsStatusShimmer 1.15s ease-in-out infinite, streamsStatusPulse 1.65s ease-in-out infinite !important;
      }
      .streamsLiveStatusBubble * {
        -webkit-text-fill-color: transparent !important;
        color: transparent !important;
      }
      @keyframes streamsStatusShimmer {
        0% { background-position: 120% 50%; }
        100% { background-position: -120% 50%; }
      }
      @keyframes streamsStatusPulse {
        0%, 100% { opacity: .55; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    let index = 0;
    let frame = 0;

    const renderStatus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bubbles = statusBubbles();
        bubbles.forEach((bubble, bubbleIndex) => {
          const current = statusTextFromBubble(bubble);
          if (!isStatusText(current)) return;
          const next = current.startsWith("Thinking") ? STATUS_TEXTS[(index + bubbleIndex) % STATUS_TEXTS.length] : current;
          bubble.classList.add("streamsLiveStatusBubble");
          bubble.innerHTML = `<span class="streamsLiveStatusText">${escapeText(next)}</span>`;
        });
        if (bubbles.length) index += 1;
      });
    };

    renderStatus();
    const timer = window.setInterval(renderStatus, 900);
    const observer = new MutationObserver(renderStatus);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      observer.disconnect();
      style.remove();
    };
  }, []);

  return null;
}
