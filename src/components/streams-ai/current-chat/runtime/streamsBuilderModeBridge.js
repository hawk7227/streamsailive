"use client";

const CONTEXT_KEY = "streams-builder:chat-context-events";
const MAX_CONTEXT_EVENTS = 80;
const MAX_CONTEXT_FOR_PROMPT = 24;

function encodeSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function makeSseResponse(text, mode = "builder-workstation") {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSseEvent("activity", { phase: "tool", mode, statusText: "Sending command to connected workstation…", startedAt })));
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
  try { return new URLSearchParams(window.location.search).get("builderMode") === "1"; } catch { return false; }
}

function defaultConnection() {
  return { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1" };
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
  return /\b(remove|delete|hide|replace|change|move|make|style|resize|align|take\s+out|get\s+rid\s+of)\b/i.test(message)
    && /\b(card|cards|button|image|section|hero|below|under|above|doctor|provider|heading|text|icon|panel|layout|visit|healthcare|personal)\b/i.test(message);
}

function isBuilderCommand(message) {
  return /\b(agent\s*1|codex|visual editing|workstation|streams builder|repo\s+[\w.-]+\/[\w.-]+|autonomousrepair|build\/typecheck|approval required|pull real source|queue.*repair)\b/i.test(message)
    || isVisualEditCommand(message);
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
  } catch {
    // Context is a best-effort assistant memory layer.
  }
}

function recordBuilderEvent(event) {
  const detail = event && typeof event === "object" ? event : {};
  const message = String(detail.message || "").trim();
  if (!message) return;
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: detail.at || new Date().toISOString(),
    phase: detail.phase || "builder-event",
    source: detail.source || "streams-builder",
    repo: detail.repo || detail.repository || "",
    branch: detail.branch || "",
    filePath: detail.filePath || detail.path || "",
    route: detail.route || "",
    patchState: detail.patchState || "",
    draftDirty: Boolean(detail.draftDirty),
    saved: detail.saved,
    message,
  };
  const current = readBuilderEvents();
  const last = current[current.length - 1];
  if (last && last.phase === normalized.phase && last.message === normalized.message && Date.now() - Date.parse(last.at || "0") < 1200) return;
  writeBuilderEvents([...current, normalized]);
}

function builderContextBlock() {
  const events = readBuilderEvents().slice(-MAX_CONTEXT_FOR_PROMPT);
  if (!events.length) return "";
  const active = [...events].reverse().find((event) => event.filePath || event.repo || event.route) || {};
  const lines = events.map((event, index) => {
    const target = [event.repo, event.branch, event.filePath, event.route].filter(Boolean).join(" | ");
    return `${index + 1}. ${event.phase || "event"}${target ? ` [${target}]` : ""}: ${event.message}`;
  });
  return [
    "",
    "ACTIVE STREAMS BUILDER EVENT CONTEXT:",
    "Use this as live workstation memory. It records file pulls, visual selections, code selections, unsaved edits, saves, patch generation, preview state, push blocking, and GitHub push results.",
    active.repo || active.filePath ? `Current source truth: repo ${active.repo || "unknown"}, branch ${active.branch || "unknown"}, file ${active.filePath || "unknown"}, route ${active.route || "unknown"}.` : "Current source truth is whatever the latest builder event resolved.",
    "Never ignore this context when answering builder questions. If a push/save/patch failed, explain the exact failure and recommend the safest next fix. If draftDirty is true or patchState is not generated, Push GitHub is blocked until Save Draft regenerates the review patch.",
    ...lines,
  ].join("\n");
}

function inferVisualEditContext(message) {
  const lower = String(message || "").toLowerCase();
  const patientLanding = /patient|doctor|provider|healthcare|visit|rx|refill|follow\s*up|private\s+review|personal\s+again/.test(lower);
  if (!isVisualEditCommand(message)) return "";
  const target = patientLanding
    ? "repo hawk7227/patientpanel branch master file src/app/page.tsx route /"
    : "use the active source-truth repo, branch, route, and page file";
  return [
    "",
    "SYSTEM BUILDER EXECUTION CONTEXT:",
    "You are inside the Streams Builder. Do not answer as an advisor giving generic instructions. Act as the builder agent that is resolving, routing, and executing the request.",
    "Do not say things like 'identify the file', 'for example', 'PatientLanding.jsx', 'you would modify', or 'verify locally' unless the real source target is unknown.",
    "Use resolved source-truth language: visualIntent, repo, branch, route, sourceFile, scope, safePatchTarget, doNotTouch, proofRequired, currentStatus.",
    "Resolve the user's visual language before queueing Codex. Map the visible target to route, source file, component usage, reusable component risk, and smallest safe patch.",
    "For one rendered instance, patch the page/section usage site. Do not edit or delete reusable component files globally unless the user explicitly asks for a global component change.",
    "Preserve unrelated layout, booking/payment/intake/provider/overlay logic, shared components, and all other sections.",
    `Source target hint: ${target}.",
    "If the user mentions cards below/under a doctor/provider/hero/Healthcare That Feels Personal Again section, treat it as a page-level rendered instance and remove the local JSX usage only.",
    "User-facing response should be operational and specific, for example: 'Resolved visual edit target: repo ..., file ..., scope usage_site. I sent this safe patch plan to Visual Editing. Check Logs for job/proof.'",
    "Stop at diff/approval. Do not commit. Do not push.",
  ].join("\n");
}

function enrichBuilderMessage(message) {
  const context = inferVisualEditContext(message);
  const liveContext = builderContextBlock();
  return [message.trim(), context, liveContext].filter(Boolean).join("\n");
}

function inferConnection(message, current) {
  const lower = String(message || "").toLowerCase();
  if (current?.connected && current?.activeWorkstationId) return current;
  if (lower.includes("visual editing") || isVisualEditCommand(message)) return { connected: true, activeWorkstationId: "visual-editing", activeWorkstationName: "Visual Editing", sessionId: "agent-1" };
  if (lower.includes("approval")) return { connected: true, activeWorkstationId: "approval-center", activeWorkstationName: "Approval Center", sessionId: "agent-1" };
  if (lower.includes("browser")) return { connected: true, activeWorkstationId: "browser-verification", activeWorkstationName: "Browser Verification", sessionId: "agent-1" };
  return { connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId: "agent-1" };
}

function fallbackStatus(message, routedConnection) {
  const liveContext = builderContextBlock();
  if (isVisualEditCommand(message)) {
    return [
      "Resolved visual edit target: visible page element described by the user.",
      "Source target: repo hawk7227/patientpanel, branch master, route /, file src/app/page.tsx, scope usage_site.",
      "Safe patch: remove only the local rendered usage in that landing-page section; do not edit or delete reusable component files globally.",
      "Protected: src/components/home/VisitCards.tsx, BookingOverlay, provider, payment, intake, visit-type logic, and unrelated page sections.",
      `Current status: routed to ${routedConnection.activeWorkstationName || "Visual Editing"}; source pull and proof events will appear in Logs. Stop at approval; no commit or push.`,
      liveContext,
    ].filter(Boolean).join("\n");
  }

  return [`Routed to ${routedConnection.activeWorkstationName || "workstation"}. The chat model response was unavailable, so check Logs for source-pull and job status.`, liveContext].filter(Boolean).join("\n");
}

export function installStreamsBuilderModeBridge() {
  if (typeof window === "undefined") return () => {};
  if (!isBuilderMode()) return () => {};
  if (window.__streamsBuilderModeBridgeInstalled) return () => {};

  let connection = defaultConnection();
  window.__streamsBuilderConnection = connection;

  const originalFetch = window.fetch.bind(window);
  window.__streamsBuilderModeBridgeInstalled = true;

  function onParentMessage(event) {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.type === "streams-builder-connection-state") {
      connection = { ...defaultConnection(), ...(data.connection || {}) };
      window.__streamsBuilderConnection = connection;
      window.dispatchEvent(new CustomEvent("streams-builder-connection-updated", { detail: connection }));
    }
    if (data.type === "streams-builder-status") {
      window.dispatchEvent(new CustomEvent("streams-builder-status", { detail: data }));
    }
    if (data.type === "streams-builder-context-event") {
      recordBuilderEvent(data.detail || {});
      window.dispatchEvent(new CustomEvent("streams-builder-context-event", { detail: data.detail || {} }));
    }
  }

  window.addEventListener("message", onParentMessage);
  window.parent?.postMessage({ type: "streams-builder-frame-ready" }, window.location.origin);

  window.fetch = async (input, init = {}) => {
    const pathname = endpointPath(input);
    const method = String(init?.method || "GET").toUpperCase();

    if (method === "POST" && isChatPostEndpoint(pathname)) {
      const body = parseChatBody(init);
      const message = messageFromBody(body);
      const shouldRoute = message && (connection?.connected && connection?.activeWorkstationId || isBuilderCommand(message) || readBuilderEvents().length);
      if (shouldRoute) {
        const routedConnection = inferConnection(message, connection);
        const routedMessage = enrichBuilderMessage(message);
        connection = routedConnection;
        window.__streamsBuilderConnection = routedConnection;
        window.parent?.postMessage({
          type: "streams-builder-chat-command",
          message: routedMessage,
          originalMessage: message,
          connection: routedConnection,
          source: "iphone-chat",
          autoConnected: true,
          builderContext: readBuilderEvents().slice(-MAX_CONTEXT_FOR_PROMPT),
          at: new Date().toISOString(),
        }, window.location.origin);
        if (isVisualEditCommand(message)) {
          return makeSseResponse(fallbackStatus(message, routedConnection));
        }
        try {
          const enrichedBody = writeMessageToBody({ ...body, builderContext: readBuilderEvents().slice(-MAX_CONTEXT_FOR_PROMPT) }, routedMessage);
          const response = await originalFetch(input, cloneInitWithBody(init, JSON.stringify(enrichedBody)));
          if (response?.ok) return response;
        } catch {
          // Fallback below keeps routing usable when the normal chat endpoint is unavailable.
        }

        return makeSseResponse(fallbackStatus(message, routedConnection));
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
