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

function overlapAppend(existing, incoming) {
  const current = String(existing || "");
  const next = String(incoming || "");
  if (!next) return current;
  if (!current) return next;
  if (current.endsWith(next)) return current;
  if (next.startsWith(current)) return next;
  const max = Math.min(current.length, next.length, 240);
  for (let size = max; size > 0; size -= 1) {
    if (current.slice(-size) === next.slice(0, size)) return current + next.slice(size);
  }
  return current + next;
}

function createCalmStream(response) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sourceBuffer = "";
  let pendingText = "";
  let emittedText = "";
  let timer = null;
  let controllerRef = null;

  function emit(name, payload) {
    controllerRef?.enqueue(encoder.encode(sseBlock(name, payload)));
  }

  function flushText() {
    if (!pendingText) return;
    const nextFull = overlapAppend(emittedText, pendingText);
    const delta = nextFull.slice(emittedText.length);
    pendingText = "";
    if (!delta) return;
    emittedText = nextFull;
    emit("response", { token: delta });
  }

  function scheduleFlush() {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = null;
      flushText();
    }, 48);
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

    if (eventName === "reasoning") {
      const statusText = payload?.statusText || payload?.text || "Thinking…";
      emit("activity", { ...payload, statusText });
      return;
    }
    if (eventName === "response") {
      const token = payload?.token || payload?.delta || payload?.text || "";
      pendingText = overlapAppend(pendingText, token);
      if (pendingText.length >= 72 || /[.!?]\s$/.test(pendingText)) flushText();
      else scheduleFlush();
      return;
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
  root.querySelectorAll?.("[style*='cursor: none'],[style*='cursor:none']").forEach((node) => node.style.setProperty("cursor", "auto", "important"));
  document.documentElement.style.setProperty("cursor", "auto", "important");
  document.body?.style.setProperty("cursor", "auto", "important");
}

function installProgressiveDisclosure() {
  const timers = new WeakMap();
  const process = (node, role) => {
    if (!(node instanceof HTMLElement) || node.dataset.disclosureReady === "true") return;
    if (role === "assistant" && node.closest(".startAssistantRow") === node.closest(".startAssistantRow")?.parentElement?.lastElementChild) return;
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
      timers.set(node, window.setTimeout(() => process(node, "assistant"), 650));
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
    const scanDisclosure = installProgressiveDisclosure();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof HTMLElement) removeCustomCursorArtifacts(node);
      }
      removeCustomCursorArtifacts();
      scanDisclosure();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    const pointerHandler = (event) => {
      removeCustomCursorArtifacts();
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!(target instanceof HTMLElement)) return;
      const interactive = target.closest("button,a,[role='button'],summary,label,select,input[type='checkbox'],input[type='radio']");
      const text = target.closest("textarea,input:not([type]),input[type='text'],input[type='search'],input[type='email'],[contenteditable='true']");
      target.style.setProperty("cursor", text ? "text" : interactive ? "pointer" : "auto", "important");
    };
    window.addEventListener("pointermove", pointerHandler, { passive: true, capture: true });

    return () => {
      window.fetch = nativeFetch;
      observer.disconnect();
      window.removeEventListener("pointermove", pointerHandler, { capture: true });
    };
  }, []);

  return <style jsx global>{`
    .streamsDisclosureToggle{display:inline-flex;margin:7px 0 0;border:0;background:transparent;color:#7dd3fc;font:700 12px/1.2 Inter,system-ui,sans-serif;cursor:pointer!important;padding:0}
    .startUserBubble[data-expanded="false"],.startAssistantBody[data-expanded="false"]{mask-image:linear-gradient(to bottom,#000 calc(100% - 28px),transparent);-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 28px),transparent)}
    .startUserBubble[data-expanded="true"],.startAssistantBody[data-expanded="true"]{mask-image:none;-webkit-mask-image:none}
    html,body,.startWorkspace,.startChatSurface,.startConversationColumn{cursor:auto!important}
    textarea,input,[contenteditable="true"]{cursor:text!important}
    button,a,[role="button"],summary,label,select{cursor:pointer!important}
  `}</style>;
}
