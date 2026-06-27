"use client";

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

function isBuilderCommand(message) {
  return /\b(agent\s*1|codex|visual editing|workstation|streams builder|repo\s+[\w.-]+\/[\w.-]+|autonomousrepair|build\/typecheck|approval required|pull real source|queue.*repair)\b/i.test(message);
}

function inferConnection(message, current) {
  const lower = String(message || "").toLowerCase();
  if (current?.connected && current?.activeWorkstationId) return current;
  if (lower.includes("visual editing")) return { connected: true, activeWorkstationId: "visual-editing", activeWorkstationName: "Visual Editing", sessionId: "agent-1" };
  if (lower.includes("approval")) return { connected: true, activeWorkstationId: "approval-center", activeWorkstationName: "Approval Center", sessionId: "agent-1" };
  if (lower.includes("browser")) return { connected: true, activeWorkstationId: "browser-verification", activeWorkstationName: "Browser Verification", sessionId: "agent-1" };
  return { connected: true, activeWorkstationId: "primary-builder", activeWorkstationName: "Primary Builder", sessionId: "agent-1" };
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
  }

  window.addEventListener("message", onParentMessage);
  window.parent?.postMessage({ type: "streams-builder-frame-ready" }, window.location.origin);

  window.fetch = async (input, init = {}) => {
    const pathname = endpointPath(input);
    const method = String(init?.method || "GET").toUpperCase();

    if (method === "POST" && isChatPostEndpoint(pathname)) {
      const body = parseChatBody(init);
      const message = messageFromBody(body);
      const shouldRoute = message && (connection?.connected && connection?.activeWorkstationId || isBuilderCommand(message));
      if (shouldRoute) {
        const routedConnection = inferConnection(message, connection);
        connection = routedConnection;
        window.__streamsBuilderConnection = routedConnection;
        window.parent?.postMessage({
          type: "streams-builder-chat-command",
          message,
          connection: routedConnection,
          source: "iphone-chat",
          autoConnected: true,
          at: new Date().toISOString(),
        }, window.location.origin);
        return makeSseResponse(`Connected to ${routedConnection.activeWorkstationName || "workstation"}. I sent your command to the workstation and started the real source pull / Codex queue path. Watch the workstation proof timeline for progress.`);
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
