"use client";

import { useEffect } from "react";

type CodeCommand = { action: string; query?: string; kind?: string };

function postToIphone(message: string) {
  const iframe = document.querySelector<HTMLIFrameElement>(".builderChatFrame iframe");
  iframe?.contentWindow?.postMessage({ type: "streams-builder-status", status: message }, window.location.origin);
}

function publish(message: string) {
  window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "code-editor", message } }));
  postToIphone(message);
}

function extractSearchQuery(text: string) {
  const quoted = text.match(/["“”']([^"“”']+)["“”']/)?.[1];
  if (quoted) return quoted.trim();
  return text.replace(/.*?(?:find|search|look for)\s+/i, "").replace(/\s+(?:in|inside|from)\s+(?:the\s+)?(?:code|editor|file).*$/i, "").trim();
}

function commandFromText(input: string): CodeCommand | null {
  const text = String(input || "").trim();
  const lower = text.toLowerCase();
  const mentionsCode = /code editor|code file|source code|editor|file/.test(lower);
  if (!mentionsCode && !/(find|search|copy|select all|highlight|circle|underline|clear marks)/.test(lower)) return null;
  if (/select all/.test(lower)) return { action: "select-all" };
  if (/copy all|copy entire|copy full/.test(lower)) return { action: "copy-all" };
  if (/copy line|current line/.test(lower)) return { action: "copy-line" };
  if (/copy selection|copy selected|copy highlighted/.test(lower)) return { action: "copy-selection" };
  if (/next match|find next|next result/.test(lower)) return { action: "next" };
  if (/prev|previous/.test(lower)) return { action: "prev" };
  if (/clear marks|clear search|clear highlight/.test(lower)) return { action: "clear" };
  if (/highlight/.test(lower)) return { action: "highlight", kind: "Highlight" };
  if (/circle/.test(lower)) return { action: "circle", kind: "Circle" };
  if (/underline/.test(lower)) return { action: "underline", kind: "Underline" };
  if (/find|search|look for/.test(lower)) return { action: "find", query: extractSearchQuery(text) };
  if (/open|show|focus|go to/.test(lower) && /code editor/.test(lower)) return { action: "open" };
  return null;
}

function openCodeEditor() {
  if (document.querySelector(".runtimeCodeEditor")) return;
  const visual = document.querySelector<HTMLElement>(".visualEditor");
  const primary = document.querySelector<HTMLElement>(".liveWorkstation");
  const root = visual || primary || document.body;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  const codeButton = buttons.find((button) => button.textContent?.trim() === "Code Editor");
  codeButton?.click();
}

function runCodeEditorCommand(command: CodeCommand, source = "Agent 1") {
  openCodeEditor();
  publish(`${source} routed command to Code Editor: ${command.action}${command.query ? ` ${command.query}` : ""}`);
  window.setTimeout(() => window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: command })), 180);
}

export default function CodeEditorAgentBridge() {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type !== "streams-builder-chat-command") return;
      const command = commandFromText(String(data.message || ""));
      if (!command) return;
      event.stopImmediatePropagation();
      runCodeEditorCommand(command, "iPhone chat");
    }

    function onAgentCommand(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail || {};
      const command = commandFromText(String(detail.prompt || ""));
      if (command) runCodeEditorCommand(command, "Agent 1");
    }

    function onEditorResult(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail || {};
      if (detail.message) postToIphone(`Code Editor: ${detail.message}`);
    }

    window.addEventListener("message", onMessage, true);
    window.addEventListener("streams-builder:agent-one-command", onAgentCommand);
    window.addEventListener("streams-builder:code-editor-result", onEditorResult);
    return () => {
      window.removeEventListener("message", onMessage, true);
      window.removeEventListener("streams-builder:agent-one-command", onAgentCommand);
      window.removeEventListener("streams-builder:code-editor-result", onEditorResult);
    };
  }, []);

  return null;
}
