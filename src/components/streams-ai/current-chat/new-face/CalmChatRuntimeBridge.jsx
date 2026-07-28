"use client";

import { useEffect } from "react";

const TARGET = "/api/streams-ai/messages";
const CURSOR_SELECTORS = [
  ".custom-cursor", ".cursor-dot", ".cursorDot", ".cursor-follower", ".cursorFollower",
  "#custom-cursor", "#cursor-dot", "[data-custom-cursor]", "[data-cursor-dot]",
  "[class*='customCursor']", "[class*='cursor-follow']", "[class*='mouse-follow']", "[class*='pointer-dot']",
];

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url || "";
}

function isTargetRequest(input, init) {
  const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  return method === "POST" && requestUrl(input).includes(TARGET);
}

function parseBlock(block) {
  let event = "message";
  const data = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try { return { event, payload: JSON.parse(data.join("\n")) }; }
  catch { return { event, payload: { token: data.join("\n") } }; }
}

function mergeCanonical(current, incoming) {
  const existing = String(current || "");
  const next = String(incoming || "");
  if (!next) return existing;
  if (!existing) return next;
  if (next === existing || existing.endsWith(next)) return existing;
  if (next.startsWith(existing)) return next;
  const max = Math.min(existing.length, next.length, 1200);
  for (let size = max; size > 0; size -= 1) {
    if (existing.slice(-size) === next.slice(0, size)) return existing + next.slice(size);
  }
  return existing + next;
}

function sse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function createStableStream(response) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let source = "";
  let canonical = "";
  let visibleLength = 0;
  let closed = false;
  let terminal = null;
  let pumpTimer = 0;
  let controllerRef = null;
  let lastActivity = "";

  const emit = (event, payload) => controllerRef?.enqueue(encoder.encode(sse(event, payload)));

  const finishWhenDrained = () => {
    if (!closed || visibleLength < canonical.length || !terminal) return;
    emit(terminal.event, terminal.payload);
    terminal = null;
    controllerRef?.close();
  };

  const pump = () => {
    pumpTimer = 0;
    if (visibleLength < canonical.length) {
      const remaining = canonical.length - visibleLength;
      const size = Math.min(remaining, remaining > 240 ? 28 : remaining > 80 ? 18 : 10);
      const token = canonical.slice(visibleLength, visibleLength + size);
      visibleLength += token.length;
      emit("response", { token });
      pumpTimer = window.setTimeout(pump, 24);
      return;
    }
    finishWhenDrained();
  };

  const schedulePump = () => {
    if (!pumpTimer) pumpTimer = window.setTimeout(pump, 16);
  };

  const consume = (block) => {
    const parsed = parseBlock(block);
    if (!parsed) return;
    const { event, payload } = parsed;
    if (event === "reasoning" || event === "activity") {
      const statusText = String(payload?.statusText || payload?.text || "Thinking…");
      if (statusText !== lastActivity) {
        lastActivity = statusText;
        emit("activity", { ...payload, statusText });
      }
      return;
    }
    if (event === "response") {
      canonical = mergeCanonical(canonical, payload?.token || payload?.delta || payload?.text || "");
      schedulePump();
      return;
    }
    if (event === "complete" || event === "error") {
      terminal = { event, payload };
      closed = true;
      schedulePump();
      return;
    }
    emit(event, payload);
  };

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            source += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
            let boundary = source.indexOf("\n\n");
            while (boundary >= 0) {
              consume(source.slice(0, boundary));
              source = source.slice(boundary + 2);
              boundary = source.indexOf("\n\n");
            }
          }
          if (source.trim()) consume(source.trim());
          closed = true;
          if (!terminal) terminal = { event: "complete", payload: {} };
          schedulePump();
        } catch (error) {
          if (pumpTimer) window.clearTimeout(pumpTimer);
          controller.error(error);
        }
      })();
    },
    cancel(reason) {
      if (pumpTimer) window.clearTimeout(pumpTimer);
      return reader.cancel(reason);
    },
  });

  return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function removeCursorArtifacts(root = document) {
  for (const selector of CURSOR_SELECTORS) root.querySelectorAll?.(selector).forEach((node) => node.remove());
  root.querySelectorAll?.("[style*='cursor: none'],[style*='cursor:none']").forEach((node) => node.style.removeProperty("cursor"));
  document.documentElement.style.setProperty("cursor", "auto", "important");
  document.body?.style.setProperty("cursor", "auto", "important");
}

function installProgressiveDisclosure() {
  const process = (node, role) => {
    if (!(node instanceof HTMLElement) || node.dataset.disclosureReady === "true") return;
    const row = node.closest(role === "user" ? ".startUserRow" : ".startAssistantRow");
    const streaming = role === "assistant" && row?.parentElement?.lastElementChild === row;
    if (streaming) return;
    const limit = role === "user" ? 168 : 380;
    if (node.scrollHeight <= limit + 8) return;
    node.dataset.disclosureReady = "true";
    node.dataset.expanded = "false";
    node.style.maxHeight = `${limit}px`;
    node.style.overflow = "hidden";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "streamsDisclosureToggle";
    button.textContent = "Show more";
    button.onclick = () => {
      const expanded = node.dataset.expanded === "true";
      node.dataset.expanded = expanded ? "false" : "true";
      node.style.maxHeight = expanded ? `${limit}px` : "none";
      node.style.overflow = expanded ? "hidden" : "visible";
      button.textContent = expanded ? "Show more" : "Show less";
    };
    node.insertAdjacentElement("afterend", button);
  };
  return () => {
    document.querySelectorAll(".startUserBubble").forEach((node) => process(node, "user"));
    document.querySelectorAll(".startAssistantBody").forEach((node) => window.setTimeout(() => process(node, "assistant"), 500));
  };
}

export default function CalmChatRuntimeBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init);
      if (!isTargetRequest(input, init)) return response;
      return (response.headers.get("content-type") || "").includes("text/event-stream") ? createStableStream(response) : response;
    };

    removeCursorArtifacts();
    const disclosure = installProgressiveDisclosure();
    disclosure();
    const observer = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) removeCursorArtifacts(node);
      removeCursorArtifacts();
      disclosure();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      window.fetch = nativeFetch;
      observer.disconnect();
    };
  }, []);

  return <style jsx global>{`
    .streamsDisclosureToggle{display:inline-flex;margin:7px 0 0;border:0;background:transparent;color:#7dd3fc;font:700 12px/1.2 Inter,system-ui,sans-serif;cursor:pointer;padding:0}
    html,body,.streamsUniversalExperience,.streamsBuilderShell,.startWorkspace,.startChatSurface{cursor:auto!important;scroll-behavior:auto!important}
    textarea,input,[contenteditable="true"]{cursor:text!important}
    button,a,[role="button"],summary,label,select{cursor:pointer!important}
  `}</style>;
}
