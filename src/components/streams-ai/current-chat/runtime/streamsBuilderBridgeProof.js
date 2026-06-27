"use client";

function isBuilderMode() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("builderMode") === "1";
  } catch {
    return false;
  }
}

function defaultConnection() {
  return { connected: false, activeWorkstationId: "", activeWorkstationName: "", sessionId: "agent-1" };
}

export function installStreamsBuilderBridgeProof() {
  if (typeof window === "undefined") return () => {};
  if (!isBuilderMode()) return () => {};
  if (window.__streamsBuilderBridgeProofInstalled) return () => {};

  window.__streamsBuilderBridgeProofInstalled = true;
  window.__streamsBuilderConnection = window.__streamsBuilderConnection || defaultConnection();

  function sendPong(pingId, connection) {
    window.parent?.postMessage({
      type: "streams-builder-bridge-pong",
      pingId: pingId || "manual-ping",
      source: "iphone-chat-frame",
      connected: Boolean(connection?.connected && connection?.activeWorkstationId),
      connection,
      at: new Date().toISOString(),
    }, window.location.origin);
  }

  function onParentMessage(event) {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.type === "streams-builder-connection-state") {
      window.__streamsBuilderConnection = { ...defaultConnection(), ...(data.connection || {}) };
    }
    if (data.type === "streams-builder-bridge-ping") {
      const connection = { ...defaultConnection(), ...(data.connection || window.__streamsBuilderConnection || {}) };
      window.__streamsBuilderConnection = connection;
      sendPong(data.pingId, connection);
    }
  }

  window.addEventListener("message", onParentMessage);
  window.parent?.postMessage({ type: "streams-builder-frame-ready", source: "iphone-chat-frame", at: new Date().toISOString() }, window.location.origin);

  return () => {
    window.removeEventListener("message", onParentMessage);
    window.__streamsBuilderBridgeProofInstalled = false;
  };
}
