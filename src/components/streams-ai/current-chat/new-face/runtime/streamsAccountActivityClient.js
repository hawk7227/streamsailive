import {
  emitAccountActivity,
  emitBillingActivity,
  emitCreditsActivity,
  emitGitHubActivity,
  emitProjectActivity,
  emitGroupChatActivity,
} from "./streamsGlobalActivityBridge";
import { STREAMS_ACTIVITY_PHASES } from "./streamsActivityEvents";

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function fetchAccountWithActivity() {
  emitAccountActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading account...");
  const response = await fetch("/api/streams-ai/account", { method: "GET" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || "Account loading failed.";
    emitAccountActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitAccountActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Account loaded");
  return data;
}

export async function fetchCreditsWithActivity() {
  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading credits...");
  const response = await fetch("/api/streams-ai/credits", { method: "GET" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || "Credits loading failed.";
    emitCreditsActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Credits loaded");
  return data;
}

export async function openBillingPortalWithActivity() {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Opening billing portal...");
  const response = await fetch("/api/stripe/portal", { method: "POST" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Billing portal failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const url = data.url || data.portalUrl;
  if (!url) {
    const reason = "Billing portal did not return a redirect URL.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Billing portal ready");
  window.location.assign(url);
  return data;
}

export async function startCheckoutWithActivity(payload = {}) {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Starting checkout...");
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Checkout failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const url = data.url || data.checkoutUrl;
  if (!url) {
    const reason = "Checkout did not return a redirect URL.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Checkout ready");
  window.location.assign(url);
  return data;
}

export async function fetchProjectsWithActivity() {
  emitProjectActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading projects...");
  const response = await fetch("/api/projects", { method: "GET" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || "Projects loading failed.";
    emitProjectActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitProjectActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Projects loaded");
  return data;
}

export async function callGroupChatWithActivity({ sessionId, action, email, name }) {
  emitGroupChatActivity(STREAMS_ACTIVITY_PHASES.RUNNING, `${action} group chat...`, { sessionId, email, name });
  const response = await fetch("/api/streams-ai/group-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action, email, name }),
  });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Group chat action failed.";
    emitGroupChatActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason, { sessionId, email, name });
    throw new Error(reason);
  }

  emitGroupChatActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Group chat updated", { sessionId, email, name });
  return data;
}

export function emitGitHubBuildBlockedActivity(label = "GitHub build/deploy action") {
  emitGitHubActivity(
    STREAMS_ACTIVITY_PHASES.BLOCKED,
    `Blocked: real ${label} backend/action is not wired to this UI yet.`,
    { tool: label }
  );
}
