"use client";

import { useEffect } from "react";
import { canShowStreamsStatus, normalizeStatusText } from "./runtime/streamsStatusRegistry";

const HIDDEN_TEXT = new Set(["Ready", "Ask anything", "Chat is ready"]);

function cleanActivityText(value = "") {
  const text = normalizeStatusText(value);
  if (!text || HIDDEN_TEXT.has(text)) return "";
  if (!canShowStreamsStatus(text)) return "";
  return text;
}

function ensureStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("streams-inline-activity-style")) return;
  const style = document.createElement("style");
  style.id = "streams-inline-activity-style";
  style.textContent = `
    .streamsStatusBridge{display:none!important}
    .streamsInlineActivityRow{width:100%;display:flex;justify-content:flex-start;margin:-14px 0 2px;padding-left:54px;box-sizing:border-box;pointer-events:none}
    .streamsInlineActivity{display:inline-flex;align-items:center;gap:8px;color:rgba(226,232,240,.72);font:650 14px/1.35 Inter,system-ui,sans-serif;letter-spacing:-.01em;background:transparent;border:0;box-shadow:none;padding:0;max-width:min(680px,calc(100vw - 72px))}
    .streamsInlineActivityDot{width:6px;height:6px;border-radius:999px;background:rgba(34,211,238,.9);box-shadow:0 0 10px rgba(34,211,238,.45);flex:none}
    .streamsInlineActivityChevron{font-size:13px;color:rgba(226,232,240,.56);padding-left:2px}
    @media(max-width:899px){.streamsInlineActivityRow{padding-left:0;margin:-10px 0 4px}.streamsInlineActivity{font-size:13px;max-width:calc(100vw - 36px)}}
  `;
  document.head.appendChild(style);
}

function findConversationColumn() {
  return document.querySelector(".startConversationColumn");
}

function ensureRow() {
  const column = findConversationColumn();
  if (!column) return null;
  let row = column.querySelector(".streamsInlineActivityRow");
  if (!row) {
    row = document.createElement("div");
    row.className = "streamsInlineActivityRow";
    row.innerHTML = `<div class="streamsInlineActivity"><span class="streamsInlineActivityDot"></span><span class="streamsInlineActivityText"></span><span class="streamsInlineActivityChevron">⌄</span></div>`;
    const spacer = column.querySelector(".startChatSpacer");
    column.insertBefore(row, spacer || null);
  }
  return row;
}

function showInlineActivity(text) {
  ensureStyle();
  const row = ensureRow();
  if (!row) return;
  const label = row.querySelector(".streamsInlineActivityText");
  if (label) label.textContent = text;
  row.style.display = "flex";
}

function hideInlineActivity() {
  const row = document.querySelector(".streamsInlineActivityRow");
  if (row) row.style.display = "none";
}

export default function StreamsAIInlineActivityBridge({ chatRuntime }) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    ensureStyle();
    const onStatus = (event) => {
      const text = cleanActivityText(event?.detail?.statusText || event?.detail?.text || "");
      if (text) showInlineActivity(text);
    };
    window.addEventListener("streams:live-status", onStatus);
    return () => window.removeEventListener("streams:live-status", onStatus);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const text = cleanActivityText(chatRuntime?.activity?.statusText || "");
    if (text && chatRuntime?.isStreaming) showInlineActivity(text);
    else if (!chatRuntime?.isStreaming) hideInlineActivity();
  }, [chatRuntime?.activity?.statusText, chatRuntime?.isStreaming]);

  return null;
}
