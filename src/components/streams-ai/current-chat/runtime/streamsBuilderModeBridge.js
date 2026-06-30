"use client";

import { getWorkspaceToolRegistry, summarizeWorkspaceCapabilities } from "@/lib/streams-builder/workspace-tool-registry";

const CONTEXT_KEY = "streams-builder:chat-context-events";
const CONNECTION_KEY = "streams-builder:chat-connection";
const MAX_CONTEXT_EVENTS = 80;
const MAX_CONTEXT_FOR_PROMPT = 28;

function encodeSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function makeSseResponse(text, mode = "builder-workstation") {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSseEvent("activity", { phase: "tool", mode, statusText: "Connected workspace context received…", startedAt })));
      controller.enqueue(encoder.encode(encodeSseEvent("response", { token: text })));
      controller.enqueue(encoder.encode(encodeSseEvent("complete", { elapsedMs: Date.now() - startedAt, mode, messageLength: text.length })));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}

function parseChatBody(init) {
  try { return init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {}; } catch { return {}; }
}

function cloneInitWithBody(init, nextBody) {
  return { ...init, body: nextBody };
}

function isBuilderMode() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("builderMode") === "1" || window.parent !== window;
  } catch {
    return false;
  }
}

function defaultConnection() {
  return { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1", mode: "standalone" };
}

function readStoredConnection() {
  try {
    const raw = window.localStorage.getItem(CONNECTION_KEY);
    return raw ? { ...defaultConnection(), ...JSON.parse(raw) } : defaultConnection();
  } catch {
    return defaultConnection();
  }
}

function writeStoredConnection(connection) {
  try { window.localStorage.setItem(CONNECTION_KEY, JSON.stringify({ ...defaultConnection(), ...(connection || {}) })); } catch {}
}

function endpointPath(input) {
  const raw = typeof input === "string" ? input : input?.url || "";
  try { return new URL(raw, window.location.origin).pathname; } catch { return raw; }
}

function isChatPostEndpoint(pathname) {
  return [
    "/api/streams-ai/messages",
    "/api/ai-assistant",
    "/api/streams/chat",
    "/api/copilot-chat",
    "/api/copilot/chat",
    "/api/streams-ai/group-chat",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function messageFromBody(body) {
  return String(body?.message || body?.input || body?.prompt || body?.text || body?.content || body?.query || "").trim();
}

function writeMessageToBody(body, message) {
  const next = { ...(body || {}) };
  if ("message" in next) next.message = message;
  else if ("input" in next) next.input = message;
  else if ("prompt" in next) next.prompt = message;
  else if ("text" in next) next.text = message;
  else if ("content" in next) next.content = message;
  else if ("query" in next) next.query = message;
  else next.message = message;
  return next;
}

function isVisualEditCommand(message) {
  return /\b(remove|delete|hide|replace|change|move|make|style|resize|align|take\s+out|get\s+rid\s+of|fix|update|edit)\b/i.test(message)
    && /\b(card|cards|button|image|section|hero|below|under|above|doctor|provider|heading|text|icon|panel|layout|visit|healthcare|personal|selected|selection|preview|visual|code)\b/i.test(message);
}

function isConnectionCommand(message) {
  return /\b(connect|disconnect|reconnect|switch|attach|detach|standalone|control|stop\s+routing|stop\s+controlling)\b/i.test(message)
    && /\b(workstation|visual editor|visual editing|code editor|browser verification|approval center|repository truth|primary builder|component mapping|truth panel|projects dashboard|workspace)\b/i.test(message);
}

function isWorkspaceQuestion(message) {
  return /\b(do\s+you\s+see|can\s+you\s+see|what\s+file|what\s+repo|what\s+branch|what\s+route|what\s+did\s+i\s+select|is\s+push\s+ready|why\s+is\s+push\s+blocked|look\s+at|see\s+the|workspace|visual editor|code editor|preview|selected)\b/i.test(message);
}

function isBuilderCommand(message) {
  return /\b(agent\s*1|codex|visual editing|visual editor|code editor|workstation|streams builder|repo\s+[\w.-]+\/[\w.-]+|autonomousrepair|build\/typecheck|approval required|pull real source|queue.*repair|browser review|generate patch|save draft|push ready)\b/i.test(message)
    || isVisualEditCommand(message)
    || isConnectionCommand(message)
    || isWorkspaceQuestion(message);
}

function readBuilderEvents() {
  try {
    const raw = window.localStorage.getItem(CONTEXT_KEY);
    const events = raw ? JSON.parse(raw) : [];
    return Array.isArray(events) ? events.slice(-MAX_CONTEXT_EVENTS) : [];
  } catch {
    return [];
  }
}

function writeBuilderEvents(events) {
  try {
    window.localStorage.setItem(CONTEXT_KEY, JSON.stringify((Array.isArray(events) ? events : []).slice(-MAX_CONTEXT_EVENTS)));
  } catch {}
}

function recordBuilderEvent(event) {
  const detail = event && typeof event === "object" ? event : {};
  const message = String(detail.message || detail.reason || detail.error || "").trim();
  if (!message) return;
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: detail.at || new Date().toISOString(),
    phase: detail.phase || detail.type || "builder-event",
    source: detail.source || "streams-builder",
    repo: detail.repo || detail.repository || "",
    branch: detail.branch || "",
    folder: detail.folder || "",
    filePath: detail.filePath || detail.path || detail.sourceFile || "",
    route: detail.route || "",
    sha: detail.sha || "",
    activeModule: detail.activeModule || "",
    viewMode: detail.viewMode || "",
    selectedText: detail.selectedText || detail.selectedElement || detail.selectedLayerId || "",
    patchState: detail.patchState || "",
    previewBuildState: detail.previewBuildState || detail.previewState || "",
    draftDirty: Boolean(detail.draftDirty),
    saved: detail.saved,
    pushReady: detail.pushReady,
    pushBlockedReason: detail.pushBlockedReason || "",
    availableToolsCount: detail.availableToolsCount,
    availableTools: detail.availableTools,
    message,
  };
  const current = readBuilderEvents();
  const last = current[current.length - 1];
  if (last && last.phase === normalized.phase && last.message === normalized.message && Date.now() - Date.parse(last.at || "0") < 1200) return;
  writeBuilderEvents([...current, normalized]);
}

function latestWorkspaceState() {
  const events = readBuilderEvents();
  return [...events].reverse().find((event) => event.phase === "workspace-state" || event.activeModule || event.filePath || event.repo || event.route || event.patchState || event.previewBuildState) || events[events.length - 1] || {};
}

function registrySummaryBlock() {
  const tools = getWorkspaceToolRegistry();
  const summary = summarizeWorkspaceCapabilities();
  return [
    "AVAILABLE WORKSPACE TOOL REGISTRY:",
    `Total tools: ${tools.length}. Categories: ${JSON.stringify(summary.toolsByCategory)}.`,
    `Approval required: ${summary.approvalRequired.join(", ") || "none"}.`,
    `Tools: ${tools.map((tool) => `${tool.name} (${tool.realPath || "no-path"})`).join("; ")}.`,
  ].join("\n");
}

function builderContextBlock() {
  const events = readBuilderEvents().slice(-MAX_CONTEXT_FOR_PROMPT);
  const connection = readStoredConnection();
  const state = latestWorkspaceState();
  const lines = events.map((event, index) => {
    const target = [event.repo, event.branch, event.filePath, event.route, event.patchState, event.previewBuildState].filter(Boolean).join(" | ");
    return `${index + 1}. ${event.phase || "event"}${target ? ` [${target}]` : ""}: ${event.message}`;
  });
  return [
    "",
    "ACTIVE STREAMS BUILDER SOURCE OF TRUTH:",
    `Connection: ${connection.connected ? `connected to ${connection.activeWorkstationName}` : connection.mode || "standalone"}. Active workstation id: ${connection.activeWorkstationId || "none"}.`,
    `Current repo: ${state.repo || "unknown"}; branch: ${state.branch || "unknown"}; file: ${state.filePath || "unknown"}; route: ${state.route || "unknown"}.`,
    `Active module: ${state.activeModule || connection.activeWorkstationName || "unknown"}; view mode: ${state.viewMode || "unknown"}.`,
    `Selected: ${state.selectedText || "none"}; patch: ${state.patchState || "unknown"}; preview: ${state.previewBuildState || "unknown"}; pushReady: ${state.pushReady === true ? "yes" : state.pushReady === false ? "no" : "unknown"}.`,
    state.pushBlockedReason ? `Push blocked reason: ${state.pushBlockedReason}.` : "",
    registrySummaryBlock(),
    "Connected chat must not claim it cannot see the workspace when this source of truth is present. Answer using this live state and route commands to the connected workstation. If disconnected, say standalone mode is active and do not use stale workspace context for actions.",
    ...lines,
  ].filter(Boolean).join("\n");
}

function inferVisualEditContext(message) {
  const lower = String(message || "").toLowerCase();
  const patientLanding = /patient|doctor|provider|healthcare|visit|rx|refill|follow\s*up|private\s+review|personal\s+again/.test(lower);
  if (!isVisualEditCommand(message)) return "";
  const state = latestWorkspaceState();
  const target = state.repo || state.filePath
    ? `repo ${state.repo || "unknown"} branch ${state.branch || "unknown"} file ${state.filePath || "unknown"} route ${state.route || "/"}`
    : patientLanding
      ? "repo hawk7227/patientpanel branch master file src/app/page.tsx route /"
      : "use the active source-truth repo, branch, route, and page file";
  return [
    "",
    "SYSTEM BUILDER EXECUTION CONTEXT:",
    "You are inside the Streams Builder when connected. Do not answer as a generic advisor. Use resolved source-truth language: visualIntent, repo, branch, route, sourceFile, scope, safePatchTarget, doNotTouch, proofRequired, currentStatus.",
    "Resolve the user's visual language before queueing Codex. Map the visible target to route, source file, component usage, reusable component risk, and smallest safe patch.",
    "For one rendered instance, patch the page/section usage site. Do not edit or delete reusable component files globally unless the user explicitly asks for a global component change.",
    "Preserve unrelated layout, booking/payment/intake/provider/overlay logic, shared components, and all other sections.",
    `Source target hint: ${target}.`,
    "Stop at diff/approval unless the user explicitly asks to push and pushReady is true.",
  ].join("\n");
}

function enrichBuilderMessage(message) {
  const context = inferVisualEditContext(message);
  const liveContext = builderContextBlock();
  return [message.trim(), context, liveContext].filter(Boolean).join("\n");
}

function workstationNameFromMessage(message, fallback) {
  const lower = String(message || "").toLowerCase();
  const known = ["Visual Editing", "Primary Builder", "Component Mapping", "Approval Center", "Browser Verification", "Repository Truth", "Projects Dashboard", "Truth Panel"];
  return known.find((name) => lower.includes(name.toLowerCase())) || fallback || "Primary Builder";
}

function workstationId(name) {
  return String(name || "workstation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workstation";
}

function inferConnection(message, current) {
  const lower = String(message || "").toLowerCase();
  if (/\bdisconnect|detach|standalone|stop\s+routing|stop\s+controlling\b/i.test(lower)) return { ...defaultConnection(), mode: "disconnected", lastConnectionEvent: "chat requested disconnect" };
  if (/\bconnect|reconnect|attach|switch|control\b/i.test(lower)) {
    const name = workstationNameFromMessage(message, current?.activeWorkstationName || latestWorkspaceState().activeModule || "Primary Builder");
    return { connected: true, activeWorkstationId: workstationId(name), activeWorkstationName: name, sessionId: "agent-1", mode: current?.connected ? "switching" : "connected", lastConnectionEvent: current?.connected ? `switching to ${name}` : `connecting to ${name}` };
  }
  if (current?.connected && current?.activeWorkstationId) return current;
  if (lower.includes("visual editing") || lower.includes("visual editor") || isVisualEditCommand(message)) return { connected: true, activeWorkstationId: "visual-editing", activeWorkstationName: "Visual Editing", sessionId: "agent-1", mode: "connected" };
  if (lower.includes("approval")) return { connected: true, activeWorkstationId: "approval-center", activeWorkstationName: "Approval Center", sessionId: "agent-1", mode: "connected" };
  if (lower.includes("browser")) return { connected: true, activeWorkstationId: "browser-verification", activeWorkstationName: "Browser Verification", sessionId: "agent-1", mode: "connected" };
  return { connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId: "agent-1", mode: "connected" };
}

function workspaceStatusResponse(message, routedConnection) {
  const state = latestWorkspaceState();
  const tools = getWorkspaceToolRegistry();
  if (routedConnection.mode === "disconnected" || !routedConnection.connected) {
    return "Disconnected. Streams AI is now in standalone mode. I will keep the chat history visible, but I will not route workspace commands or use old workstation context as active state until you connect again.";
  }
  return [
    `Connected to ${routedConnection.activeWorkstationName || state.activeModule || "the active workstation"}.`,
    `I see repo ${state.repo || "unknown"}, branch ${state.branch || "unknown"}, file ${state.filePath || "unknown"}, route ${state.route || "unknown"}.`,
    `Selected target: ${state.selectedText || "none"}.`,
    `Patch state: ${state.patchState || "unknown"}. Preview state: ${state.previewBuildState || "unknown"}. Push ready: ${state.pushReady === true ? "yes" : "no/unknown"}.`,
    state.pushBlockedReason ? `Push blocked reason: ${state.pushBlockedReason}` : "",
    `Workspace tools wired into source of truth: ${tools.length}.`,
    isVisualEditCommand(message) ? "I routed this to the connected workstation with the current source-truth context." : "",
  ].filter(Boolean).join("\n");
}

export function installStreamsBuilderModeBridge() {
  if (typeof window === "undefined") return () => {};
  if (!isBuilderMode()) return () => {};
  if (window.__streamsBuilderModeBridgeInstalled) return () => {};

  let connection = readStoredConnection();
  if (!connection.mode || connection.mode === "standalone") connection = { ...connection, mode: "detected_builder" };
  window.__streamsBuilderConnection = connection;

  const originalFetch = window.fetch.bind(window);
  window.__streamsBuilderModeBridgeInstalled = true;

  function onParentMessage(event) {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.type === "streams-builder-connection-state") {
      connection = { ...defaultConnection(), ...(data.connection || {}) };
      writeStoredConnection(connection);
      window.__streamsBuilderConnection = connection;
      window.dispatchEvent(new CustomEvent("streams-builder-connection-updated", { detail: connection }));
    }
    if (data.type === "streams-builder-disconnect") {
      connection = { ...defaultConnection(), mode: "disconnected", lastConnectionEvent: "parent disconnect" };
      writeStoredConnection(connection);
      window.__streamsBuilderConnection = connection;
      window.dispatchEvent(new CustomEvent("streams-builder-connection-updated", { detail: connection }));
    }
    if (data.type === "streams-builder-switch-workstation") {
      const name = data.activeWorkstationName || data.workstationName || "Primary Builder";
      connection = { connected: true, activeWorkstationId: workstationId(name), activeWorkstationName: name, sessionId: "agent-1", mode: "connected", lastConnectionEvent: `parent switched to ${name}` };
      writeStoredConnection(connection);
      window.__streamsBuilderConnection = connection;
      window.dispatchEvent(new CustomEvent("streams-builder-connection-updated", { detail: connection }));
    }
    if (data.type === "streams-builder-tools-state") {
      window.__streamsBuilderTools = data;
      recordBuilderEvent({ phase: "tool-registry", source: "workspace-tool-registry", message: `Workspace tool registry available: ${Array.isArray(data.tools) ? data.tools.length : 0} tools.`, availableToolsCount: Array.isArray(data.tools) ? data.tools.length : 0, availableTools: Array.isArray(data.tools) ? data.tools.map((tool) => tool.name) : [] });
    }
    if (data.type === "streams-builder-status") {
      window.dispatchEvent(new CustomEvent("streams-builder-status", { detail: data }));
      if (data.status || data.message) recordBuilderEvent({ phase: "status", source: "parent", message: data.status || data.message });
    }
    if (data.type === "streams-builder-context-event") {
      recordBuilderEvent(data.detail || {});
      window.dispatchEvent(new CustomEvent("streams-builder-context-event", { detail: data.detail || {} }));
    }
  }

  window.addEventListener("message", onParentMessage);
  window.parent?.postMessage({ type: "streams-builder-frame-ready", source: "iphone-chat-frame", at: new Date().toISOString() }, window.location.origin);

  window.fetch = async (input, init = {}) => {
    const pathname = endpointPath(input);
    const method = String(init?.method || "GET").toUpperCase();

    if (method === "POST" && isChatPostEndpoint(pathname)) {
      const body = parseChatBody(init);
      const message = messageFromBody(body);
      const storedEvents = readBuilderEvents();
      const shouldRoute = Boolean(message && (isConnectionCommand(message) || (connection?.connected && connection?.activeWorkstationId) || isBuilderCommand(message) || storedEvents.length));
      if (shouldRoute) {
        const routedConnection = inferConnection(message, connection);
        connection = routedConnection;
        writeStoredConnection(routedConnection);
        window.__streamsBuilderConnection = routedConnection;
        const routedMessage = enrichBuilderMessage(message);
        window.parent?.postMessage({
          type: "streams-builder-chat-command",
          message: routedMessage,
          originalMessage: message,
          connection: routedConnection,
          source: "iphone-chat",
          autoConnected: Boolean(routedConnection.connected),
          builderContext: readBuilderEvents().slice(-MAX_CONTEXT_FOR_PROMPT),
          workspaceTools: getWorkspaceToolRegistry().map((tool) => ({ name: tool.name, category: tool.category, realPath: tool.realPath, requiresApproval: tool.requiresApproval })),
          at: new Date().toISOString(),
        }, window.location.origin);

        if (isWorkspaceQuestion(message) || isConnectionCommand(message) || isVisualEditCommand(message)) {
          return makeSseResponse(workspaceStatusResponse(message, routedConnection));
        }

        try {
          const enrichedBody = writeMessageToBody({ ...body, builderContext: readBuilderEvents().slice(-MAX_CONTEXT_FOR_PROMPT), workspaceConnection: routedConnection, workspaceTools: getWorkspaceToolRegistry() }, routedMessage);
          const response = await originalFetch(input, cloneInitWithBody(init, JSON.stringify(enrichedBody)));
          if (response?.ok) return response;
        } catch {}

        return makeSseResponse(workspaceStatusResponse(message, routedConnection));
      }
    }

    return originalFetch(input, init);
  };

  return () => {
    window.removeEventListener("message", onParentMessage);
    window.fetch = originalFetch;
    window.__streamsBuilderModeBridgeInstalled = false;
    window.__streamsBuilderConnection = defaultConnection();
  };
}
