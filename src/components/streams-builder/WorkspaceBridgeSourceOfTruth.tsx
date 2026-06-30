"use client";

import { useEffect, useRef } from "react";
import { getWorkspaceToolRegistry, summarizeWorkspaceCapabilities } from "@/lib/streams-builder/workspace-tool-registry";
import type { BuilderChatConnection, PulledFileDetail } from "./builderSystemContract";

const ACTIVE_FILE_KEY = "streams-builder:active-file";
const CONNECTION_KEY = "streams-builder:chat-connection";
const CONTEXT_KEY = "streams-builder:chat-context-events";
const MAX_EVENTS = 80;

const EMPTY_CONNECTION: BuilderChatConnection = {
  connected: false,
  activeWorkstationId: "",
  activeWorkstationName: "",
  sessionId: "agent-1",
};

type BridgeState = BuilderChatConnection & {
  mode: "standalone" | "detected_builder" | "connected" | "switching" | "disconnected" | "blocked";
  lastConnectionEvent?: string;
  lastContextEvent?: string;
  lastRoutedCommand?: string;
};

type BuilderContextEvent = {
  phase?: string;
  message?: string;
  source?: string;
  repo?: string;
  branch?: string;
  filePath?: string;
  path?: string;
  route?: string;
  patchState?: string;
  previewBuildState?: string;
  draftDirty?: boolean;
  saved?: boolean;
  [key: string]: unknown;
};

function workstationId(name: string) {
  return String(name || "workstation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workstation";
}

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

function readActiveFile(): Partial<PulledFileDetail> {
  return readJson<Partial<PulledFileDetail>>(ACTIVE_FILE_KEY, {});
}

function readConnection(): BridgeState {
  const saved = readJson<Partial<BridgeState>>(CONNECTION_KEY, {});
  return { ...EMPTY_CONNECTION, mode: saved.connected ? "connected" : "detected_builder", ...saved } as BridgeState;
}

function writeConnection(next: BridgeState) {
  writeJson(CONNECTION_KEY, next);
}

function rememberContext(detail: BuilderContextEvent) {
  const message = String(detail.message || "").trim();
  if (!message) return;
  const normalized = {
    ...detail,
    at: String(detail.at || new Date().toISOString()),
    phase: String(detail.phase || "workspace-state"),
    source: String(detail.source || "workspace-source-of-truth"),
    message,
  };
  const current = readJson<BuilderContextEvent[]>(CONTEXT_KEY, []);
  const last = current[current.length - 1];
  if (last?.phase === normalized.phase && last?.message === normalized.message) return;
  writeJson(CONTEXT_KEY, [...current, normalized].slice(-MAX_EVENTS));
}

function compact(value: string | undefined | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function text(selector: string) {
  return compact(document.querySelector<HTMLElement>(selector)?.innerText || document.querySelector<HTMLInputElement>(selector)?.value || "");
}

function currentActiveModule() {
  const controls = Array.from(document.querySelectorAll<HTMLSelectElement>(".topRow .controls select"));
  return controls[0]?.value || "Primary Builder";
}

function currentViewMode() {
  const controls = Array.from(document.querySelectorAll<HTMLSelectElement>(".topRow .controls select"));
  return controls[1]?.value || "Single";
}

function currentSelectedText() {
  return text(".visualEditor .sourceActionStrip div:nth-child(2) b") || text(".liveWorkstation .toolStrip div:nth-child(2) b") || "";
}

function currentPatchState() {
  return text(".visualEditor .sourceActionStrip div:nth-child(4) b") || "";
}

function currentPreviewState() {
  return text(".visualEditor .sourceActionStrip div:nth-child(5) b") || text(".liveWorkstation .toolStrip div:nth-child(5) b") || "";
}

function currentRoute() {
  return text(".visualEditor .sourceActionStrip div:nth-child(1) b") || text(".liveWorkstation .toolStrip div:nth-child(1) b") || readActiveFile().route || "/";
}

function frame() {
  return document.querySelector<HTMLIFrameElement>("iframe[title='Streams AI']");
}

function postToChat(payload: Record<string, unknown>) {
  frame()?.contentWindow?.postMessage(payload, window.location.origin);
}

function toolPayload() {
  const tools = getWorkspaceToolRegistry();
  return {
    type: "streams-builder-tools-state",
    source: "workspace-source-of-truth",
    tools,
    summary: summarizeWorkspaceCapabilities(),
    at: new Date().toISOString(),
  };
}

function snapshot(connection: BridgeState, reason = "workspace-state") {
  const activeFile = readActiveFile();
  const tools = getWorkspaceToolRegistry();
  const selected = currentSelectedText();
  return {
    type: "streams-builder-context-event",
    detail: {
      phase: "workspace-state",
      source: "workspace-source-of-truth",
      message: `Workspace source of truth updated: ${connection.connected ? `connected to ${connection.activeWorkstationName}` : connection.mode || "detected"}; active module ${currentActiveModule()}; file ${activeFile.path || "none"}.`,
      reason,
      connection,
      activeModule: currentActiveModule(),
      viewMode: currentViewMode(),
      repo: activeFile.repo || "",
      branch: activeFile.branch || "",
      folder: activeFile.folder || "",
      filePath: activeFile.path || "",
      path: activeFile.path || "",
      sha: activeFile.sha || "",
      route: currentRoute(),
      selectedText: selected,
      selectedElement: selected,
      patchState: currentPatchState(),
      previewBuildState: currentPreviewState(),
      draftDirty: /not_generated|failed/i.test(currentPatchState()),
      saved: /generated|approved|pushed/i.test(currentPatchState()),
      pushReady: /generated/i.test(currentPatchState()) && /succeeded/i.test(currentPreviewState()),
      pushBlockedReason: /generated/i.test(currentPatchState()) && /succeeded/i.test(currentPreviewState()) ? "" : "Save Draft must generate a patch and real temporary preview before push.",
      availableToolsCount: tools.length,
      availableTools: tools.map((tool) => tool.name),
      toolSummary: summarizeWorkspaceCapabilities(),
      at: new Date().toISOString(),
    },
  };
}

function parseTargetWorkstation(message: string, fallback: string) {
  const lower = message.toLowerCase();
  const known = ["Visual Editing", "Primary Builder", "Component Mapping", "Approval Center", "Browser Verification", "Repository Truth", "Projects Dashboard", "Truth Panel"];
  return known.find((name) => lower.includes(name.toLowerCase())) || fallback || "Primary Builder";
}

function isDisconnectCommand(message: string) {
  return /\b(disconnect|detach|standalone mode|stop controlling|stop routing)\b/i.test(message);
}

function isConnectCommand(message: string) {
  return /\b(connect|reconnect|attach|switch to|control)\b/i.test(message) && /\b(workstation|visual editing|primary builder|approval center|browser verification|repository truth|component mapping|truth panel|projects dashboard)\b/i.test(message);
}

export default function WorkspaceBridgeSourceOfTruth() {
  const connectionRef = useRef<BridgeState>({ ...EMPTY_CONNECTION, mode: "detected_builder" });
  const lastBroadcastRef = useRef(0);

  useEffect(() => {
    connectionRef.current = readConnection();

    function setConnection(next: BridgeState, reason: string) {
      connectionRef.current = next;
      writeConnection(next);
      postToChat({ type: "streams-builder-connection-state", connection: next, reason, at: new Date().toISOString() });
      postToChat(toolPayload());
      const state = snapshot(next, reason);
      rememberContext(state.detail as BuilderContextEvent);
      postToChat(state);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { ...(state.detail as object), phase: "connection-state", message: `Chat bridge ${next.connected ? `connected to ${next.activeWorkstationName}` : next.mode}.` } }));
    }

    function broadcast(reason = "event") {
      const now = Date.now();
      if (now - lastBroadcastRef.current < 180) return;
      lastBroadcastRef.current = now;
      const state = snapshot(connectionRef.current, reason);
      rememberContext(state.detail as BuilderContextEvent);
      postToChat(state);
      postToChat(toolPayload());
      if (connectionRef.current.connected) postToChat({ type: "streams-builder-connection-state", connection: connectionRef.current, reason, at: new Date().toISOString() });
    }

    function onAnyContext(event: Event) {
      const detail = (event as CustomEvent<BuilderContextEvent>).detail || {};
      rememberContext(detail);
      connectionRef.current = { ...connectionRef.current, lastContextEvent: String(detail.message || detail.phase || "context") };
      writeConnection(connectionRef.current);
      broadcast(String(detail.phase || "context"));
    }

    function onPulledFile() { broadcast("pulled-file"); }
    function onCodeState() { broadcast("code-editor-state"); }

    function onFrameMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === "streams-builder-frame-ready") {
        postToChat({ type: "streams-builder-connection-state", connection: connectionRef.current, reason: "frame-ready", at: new Date().toISOString() });
        postToChat(toolPayload());
        broadcast("frame-ready");
        return;
      }
      if (data.type !== "streams-builder-chat-command") return;
      const original = String(data.originalMessage || data.message || "");
      if (!isDisconnectCommand(original) && !isConnectCommand(original)) return;
      event.stopImmediatePropagation?.();
      const target = parseTargetWorkstation(original, currentActiveModule());
      if (isDisconnectCommand(original)) {
        setConnection({ ...EMPTY_CONNECTION, mode: "disconnected", lastConnectionEvent: "disconnected by chat command", lastRoutedCommand: original }, "chat-disconnect-command");
        return;
      }
      const next: BridgeState = {
        connected: true,
        activeWorkstationId: workstationId(target),
        activeWorkstationName: target,
        sessionId: "agent-1",
        mode: connectionRef.current.connected ? "switching" : "connected",
        lastConnectionEvent: connectionRef.current.connected ? `switched from ${connectionRef.current.activeWorkstationName} to ${target}` : `connected to ${target}`,
        lastRoutedCommand: original,
      };
      setConnection(next, connectionRef.current.connected ? "chat-switch-command" : "chat-connect-command");
      window.setTimeout(() => setConnection({ ...next, mode: "connected" }, "chat-connect-confirmed"), 80);
    }

    window.addEventListener("message", onFrameMessage, true);
    window.addEventListener("streams-builder:pulled-file", onPulledFile as EventListener);
    window.addEventListener("streams-builder-summary-event", onAnyContext as EventListener);
    window.addEventListener("streams-builder:chat-context-event", onAnyContext as EventListener);
    window.addEventListener("streams-builder:code-editor-state", onCodeState as EventListener);
    window.addEventListener("streams-builder:code-editor-result", onAnyContext as EventListener);
    window.addEventListener("streams-builder:runtime-job", onAnyContext as EventListener);
    window.addEventListener("streams-builder:media-output", onAnyContext as EventListener);
    const timer = window.setInterval(() => broadcast("interval-refresh"), 2500);
    window.setTimeout(() => broadcast("initial"), 250);
    return () => {
      window.removeEventListener("message", onFrameMessage, true);
      window.removeEventListener("streams-builder:pulled-file", onPulledFile as EventListener);
      window.removeEventListener("streams-builder-summary-event", onAnyContext as EventListener);
      window.removeEventListener("streams-builder:chat-context-event", onAnyContext as EventListener);
      window.removeEventListener("streams-builder:code-editor-state", onCodeState as EventListener);
      window.removeEventListener("streams-builder:code-editor-result", onAnyContext as EventListener);
      window.removeEventListener("streams-builder:runtime-job", onAnyContext as EventListener);
      window.removeEventListener("streams-builder:media-output", onAnyContext as EventListener);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
