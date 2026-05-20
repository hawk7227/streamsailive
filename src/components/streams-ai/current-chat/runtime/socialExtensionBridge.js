const BRIDGE_REQUEST_EVENT = "streams:social-extension-request";
const BRIDGE_RESPONSE_EVENT = "streams:social-extension-response";

function createRequestId() {
  return `social_bridge_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function waitForResponse(requestId, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      reject(new Error("Social Intelligence extension did not respond."));
    }, timeoutMs);

    function onResponse(event) {
      const detail = event?.detail || {};
      if (detail.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      if (detail.ok === false) reject(new Error(detail.error || "Extension request failed."));
      else resolve(detail.data || detail);
    }

    window.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
  });
}

export function isSocialExtensionBridgeAvailable() {
  return typeof window !== "undefined";
}

export async function sendSocialExtensionCommand(type, payload = {}, options = {}) {
  if (!isSocialExtensionBridgeAvailable()) {
    throw new Error("Social extension bridge is only available in the browser.");
  }

  const requestId = createRequestId();
  window.dispatchEvent(new CustomEvent(BRIDGE_REQUEST_EVENT, {
    detail: {
      source: "streams-chat",
      requestId,
      type,
      payload,
      createdAt: new Date().toISOString(),
    },
  }));

  return waitForResponse(requestId, options.timeoutMs || 8000);
}

export async function getSocialExtensionStatus() {
  return sendSocialExtensionCommand("STREAMS_GET_STATUS");
}

export async function getSocialExtensionSettings() {
  return sendSocialExtensionCommand("STREAMS_GET_SETTINGS");
}

export async function updateSocialExtensionSettings(settings) {
  return sendSocialExtensionCommand("STREAMS_UPDATE_SETTINGS", { settings });
}

export async function startSocialScan(platform = "all") {
  return sendSocialExtensionCommand("STREAMS_START_SCAN", { platform }, { timeoutMs: 15000 });
}

export async function stopSocialScan(platform = "all") {
  return sendSocialExtensionCommand("STREAMS_STOP_SCAN", { platform });
}

export async function getSocialScanResults({ platform = "all", limit = 50 } = {}) {
  return sendSocialExtensionCommand("STREAMS_GET_RESULTS", { platform, limit });
}

export const SOCIAL_EXTENSION_CAPABILITIES = [
  "read extension health",
  "read/update scanner settings",
  "start/stop platform scans",
  "read scan results",
  "send social results into STREAMS analyzer",
  "explain login/API/scraper errors",
];
