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
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || "GET").toUpperCase();

    if (method === "POST" && url === "/api/streams-ai/messages" && connection?.connected && connection?.activeWorkstationId) {
      const body = parseChatBody(init);
      const message = String(body?.message || body?.input || body?.prompt || body?.text || body?.content || "").trim();
      if (message) {
        window.parent?.postMessage({
          type: "streams-builder-chat-command",
          message,
          connection,
          source: "iphone-chat",
          at: new Date().toISOString(),
        }, window.location.origin);
        return makeSseResponse(`Connected to ${connection.activeWorkstationName || "workstation"}. I sent your command to that workstation so you can see the work happen in the editor/preview instead of copying and pasting.`);
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
