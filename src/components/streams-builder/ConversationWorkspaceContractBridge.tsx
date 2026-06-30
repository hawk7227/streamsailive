"use client";

import { useEffect } from "react";
import { getWorkspaceToolRegistry, summarizeWorkspaceCapabilities } from "@/lib/streams-builder/workspace-tool-registry";

const CONVERSATION_KEY = "streams-ai:conversation-state";
const CONTEXT_KEY = "streams-builder:chat-context-events";
const ACTIVE_FILE_KEY = "streams-builder:active-file";
const CONNECTION_KEY = "streams-builder:chat-connection";
const MAX_EVENTS = 80;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function frame() {
  return document.querySelector<HTMLIFrameElement>("iframe[title='Streams AI']");
}

function remember(detail: Record<string, unknown>) {
  const message = String(detail.message || detail.reason || detail.phase || "contract event").trim();
  const normalized = { ...detail, message, at: String(detail.at || new Date().toISOString()) };
  const current = readJson<Record<string, unknown>[]>(CONTEXT_KEY, []);
  const last = current[current.length - 1];
  if (last?.phase === normalized.phase && last?.message === normalized.message) return;
  writeJson(CONTEXT_KEY, [...current, normalized].slice(-MAX_EVENTS));
}

function mergedContract(reason = "contract-refresh") {
  const conversationState = readJson<Record<string, unknown>>(CONVERSATION_KEY, {});
  const activeFile = readJson<Record<string, unknown>>(ACTIVE_FILE_KEY, {});
  const connection = readJson<Record<string, unknown>>(CONNECTION_KEY, {});
  const tools = getWorkspaceToolRegistry();
  return {
    phase: "merged-conversation-workspace-contract",
    source: "conversation-workspace-contract-bridge",
    message: `Merged chat contract ready: session ${conversationState.sessionId || "new"}; file ${activeFile.path || "none"}; workstation ${connection.activeWorkstationName || "standalone"}.`,
    reason,
    conversationState,
    workspaceState: {
      connection,
      repo: activeFile.repo || "",
      branch: activeFile.branch || "",
      filePath: activeFile.path || "",
      route: activeFile.route || "/",
      sha: activeFile.sha || "",
    },
    availableToolsCount: tools.length,
    availableTools: tools.map((tool) => ({ name: tool.name, category: tool.category, realPath: tool.realPath, requiresApproval: tool.requiresApproval })),
    toolSummary: summarizeWorkspaceCapabilities(),
    at: new Date().toISOString(),
  };
}

function publish(reason = "contract-refresh") {
  const detail = mergedContract(reason);
  remember(detail);
  window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail }));
  window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail }));
  frame()?.contentWindow?.postMessage({ type: "streams-builder-context-event", detail, source: "conversation-workspace-contract-bridge", at: detail.at }, window.location.origin);
}

export default function ConversationWorkspaceContractBridge() {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (typeof data.type !== "string" || !data.type.startsWith("streams-ai:")) return;
      const detail = { ...(data.detail || {}), phase: data.type.replace(/^streams-ai:/, ""), source: data.source || "streams-ai-chat-frame" };
      writeJson(CONVERSATION_KEY, detail);
      remember(detail);
      publish(detail.phase || data.type);
    }
    function onLocalEvent(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      writeJson(CONVERSATION_KEY, detail);
      remember(detail);
      publish(String(detail.phase || "local-conversation-state"));
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("streams-ai:conversation-state", onLocalEvent as EventListener);
    window.addEventListener("streams-ai:composer-draft-state", onLocalEvent as EventListener);
    window.addEventListener("streams-ai:recent-chats-state", onLocalEvent as EventListener);
    window.addEventListener("streams-ai:thread-assets-state", onLocalEvent as EventListener);
    window.addEventListener("streams-ai:streaming-recovery-state", onLocalEvent as EventListener);
    const timer = window.setInterval(() => publish("interval-refresh"), 2500);
    window.setTimeout(() => publish("initial"), 300);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("streams-ai:conversation-state", onLocalEvent as EventListener);
      window.removeEventListener("streams-ai:composer-draft-state", onLocalEvent as EventListener);
      window.removeEventListener("streams-ai:recent-chats-state", onLocalEvent as EventListener);
      window.removeEventListener("streams-ai:thread-assets-state", onLocalEvent as EventListener);
      window.removeEventListener("streams-ai:streaming-recovery-state", onLocalEvent as EventListener);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
