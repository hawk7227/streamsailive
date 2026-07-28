"use client";

import { useEffect } from "react";

const TARGET = "/api/streams-ai/messages";
const CURSOR_SELECTORS = [
  ".custom-cursor",
  ".cursor-dot",
  ".cursorDot",
  "#custom-cursor",
  "#cursor-dot",
  "[data-custom-cursor]",
  "[data-cursor-dot]",
  "[class*='customCursor']",
  "[class*='cursor-follow']",
  "[class*='mouse-follow']",
];

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url || "";
}

function isTargetRequest(input, init) {
  const url = requestUrl(input);
  const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  return method === "POST" && url.includes(TARGET);
}

function sseBlock(eventName, payload) {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function mergeResponseText(current, incoming) {
  const existing = String(current || "");
  const next = String(incoming || "");
  if (!next) return existing;
  if (!existing) return next;
  if (next === existing || existing.endsWith(next)) return existing;
  if (next.startsWith(existing)) return next;
  const max = Math.min(existing.length, next.length, 600);
  for (let size = max; size > 0; size -= 1) {
    if (existing.slice(-size) === next.slice(0, size)) return existing + next.slice(size);
  }
  return existing + next;
}

function createCalmStream(response) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sourceBuffer = "";
  let canonicalText = "";
  let emittedText = "";
  let timer = null;
  let controllerRef = null;
  let lastActivity = "";

  function emit(name, payload) {
    controllerRef?.enqueue(encoder.encode(sseBlock(name, payload)));
  }

  function flushText() {
    if (canonicalText.length <= emittedText.length) return;
    const delta = canonicalText.slice(emittedText.length);
    emittedText = canonicalText;
    emit("response", { token: delta });
  }

  function scheduleFlush(delay = 88) {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = null;
      flushText();
    }, delay);
  }

  function consumeBlock(block) {
    const lines = block.split("\n");
    let eventName = "message";
    const data = [];
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    let payload;
    try { payload = JSON.parse(data.join("\n")); }
    catch { payload = { token: data.join("\n") }; }

    if (eventName === "reasoning" || eventName === "activity") {
      const statusText = String(payload?.statusText || payload?.text || "Thinking…");
      if (statusText !== lastActivity) {
        lastActivity = statusText;
        emit("activity", { ...payload, statusText });
      }
      return;
    }

    if (eventName === "response") {
      const token = payload?.token || payload?.delta || payload?.text || "";
      canonicalText = mergeResponseText(canonicalText, token);
      if (canonicalText.length - emittedText.length >= 140 || /[.!?]\s$/.test(canonicalText)) flushText();
      else scheduleFlush();
      return;
    }

    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    flushText();
    emit(eventName, payload);
  }

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sourceBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
            let boundary = sourceBuffer.indexOf("\n\n");
            while (boundary >= 0) {
              consumeBlock(sourceBuffer.slice(0, boundary));
              sourceBuffer = sourceBuffer.slice(boundary + 2);
              boundary = sourceBuffer.indexOf("\n\n");
            }
          }
          if (sourceBuffer.trim()) consumeBlock(sourceBuffer.trim());
          if (timer) window.clearTimeout(timer);
          timer = null;
          flushText();
          controller.close();
        } catch (error) {
          if (timer) window.clearTimeout(timer);
          controller.error(error);
        }
      })();
    },
    cancel(reason) {
      if (timer) window.clearTimeout(timer);
      return reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function removeCustomCursorArtifacts(root = document) {
  for (const selector of CURSOR_SELECTORS) root.querySelectorAll?.(selector).forEach((node) => node.remove());
  root.querySelectorAll?.("[style*='cursor: none'],[style*='cursor:none']").forEach((node) => node.style.removeProperty("cursor"));

  root.querySelectorAll?.("div,span").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const name = `${node.id} ${node.className}`.toLowerCase();
    const cursorNamed = /cursor|mouse|pointer-follow|pointer-dot/.test(name);
    const cursorShaped = style.position === "fixed" && style.pointerEvents === "none" && rect.width <= 40 && rect.height <= 40 && Number(style.zIndex || 0) >= 1000;
    if (cursorNamed || cursorShaped) node.remove();
  });

  document.documentElement.style.removeProperty("cursor");
  document.body?.style.removeProperty("cursor");
}

function installStableConversationScroll() {
  const states = new WeakMap();

  const prepare = (node) => {
    if (!(node instanceof HTMLElement) || states.has(node)) return;
    const state = { nearBottom: true, frame: 0, originalScrollTo: node.scrollTo.bind(node) };
    const updateNearBottom = () => {
      state.nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 140;
    };
    node.addEventListener("scroll", updateNearBottom, { passive: true });
    node.style.scrollBehavior = "auto";
    node.scrollTo = (optionsOrX, y) => {
      if (typeof optionsOrX === "object") state.originalScrollTo({ ...optionsOrX, behavior: "auto" });
      else state.originalScrollTo(optionsOrX, y);
    };
    state.cleanup = () => node.removeEventListener("scroll", updateNearBottom);
    states.set(node, state);
  };

  const anchor = () => {
    document.querySelectorAll(".startChatSurface").forEach((node) => {
      prepare(node);
      const state = states.get(node);
      if (!state?.nearBottom) return;
      cancelAnimationFrame(state.frame);
      state.frame = requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
    });
  };

  anchor();
  return { anchor, cleanup: () => states.forEach?.((state) => state.cleanup?.()) };
}

function installProgressiveDisclosure() {
  const timers = new WeakMap();
  const process = (node, role) => {
    if (!(node instanceof HTMLElement) || node.dataset.disclosureReady === "true") return;
    const row = node.closest(role === "user" ? ".startUserRow" : ".startAssistantRow");
    const isStreamingRow = role === "assistant" && row?.parentElement?.lastElementChild === row;
    if (isStreamingRow) return;
    const limit = role === "user" ? 168 : 380;
    if (node.scrollHeight <= limit + 8) return;
    node.dataset.disclosureReady = "true";
    node.dataset.expanded = "false";
    node.style.maxHeight = `${limit}px`;
    node.style.overflow = "hidden";
    node.style.position = "relative";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "streamsDisclosureToggle";
    button.textContent = "Show more";
    button.addEventListener("click", () => {
      const expanded = node.dataset.expanded === "true";
      node.dataset.expanded = expanded ? "false" : "true";
      node.style.maxHeight = expanded ? `${limit}px` : "none";
      node.style.overflow = expanded ? "hidden" : "visible";
      button.textContent = expanded ? "Show more" : "Show less";
    });
    node.insertAdjacentElement("afterend", button);
  };

  const scan = () => {
    document.querySelectorAll(".startUserBubble").forEach((node) => process(node, "user"));
    document.querySelectorAll(".startAssistantBody").forEach((node) => {
      const old = timers.get(node);
      if (old) window.clearTimeout(old);
      timers.set(node, window.setTimeout(() => process(node, "assistant"), 900));
    });
  };
  scan();
  return scan;
}

export default function CalmChatRuntimeBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init);
      if (!isTargetRequest(input, init)) return response;
      const type = response.headers.get("content-type") || "";
      return type.includes("text/event-stream") ? createCalmStream(response) : response;
    };

    removeCustomCursorArtifacts();
    const disclosure = installProgressiveDisclosure();
    const stableScroll = installStableConversationScroll();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof HTMLElement) removeCustomCursorArtifacts(node);
      }
      removeCustomCursorArtifacts();
      disclosure();
      stableScroll.anchor();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      window.fetch = nativeFetch;
      observer.disconnect();
      stableScroll.cleanup?.();
    };
  }, []);

  return <style jsx global>{`
    .streamsDisclosureToggle{display:inline-flex;margin:7px 0 0;border:0;background:transparent;color:#7dd3fc;font:700 12px/1.2 Inter,system-ui,sans-serif;cursor:pointer;padding:0}
    .startUserBubble[data-expanded="false"],.startAssistantBody[data-expanded="false"]{mask-image:linear-gradient(to bottom,#000 calc(100% - 28px),transparent);-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 28px),transparent)}
    .startUserBubble[data-expanded="true"],.startAssistantBody[data-expanded="true"]{mask-image:none;-webkit-mask-image:none}
    html,body,.startWorkspace,.startChatSurface,.startConversationColumn{cursor:auto!important;scroll-behavior:auto!important}
    textarea,input,[contenteditable="true"]{cursor:text!important}
    button,a,[role="button"],summary,label,select{cursor:pointer!important}
  `}</style>;
}
