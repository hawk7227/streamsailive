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

function pickRedirectUrl(data) {
  return (
    data?.url ||
    data?.portalUrl ||
    data?.checkoutUrl ||
    data?.redirectUrl ||
    data?.session?.url ||
    data?.data?.url ||
    ""
  );
}

function assertRedirectUrl(data, fallbackMessage) {
  const url = pickRedirectUrl(data);

  if (!url || typeof url !== "string") {
    throw new Error(fallbackMessage);
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.toString();
  } catch {
    throw new Error("Redirect URL returned by backend is invalid.");
  }
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

  const response = await fetch("/api/streams-ai/credits", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Credits loading failed.";
    emitCreditsActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const normalized = {
    ...data,
    availableCredits:
      data?.availableCredits ??
      data?.available_credits ??
      data?.credits?.available ??
      data?.balance ??
      data?.balance_after ??
      null,
    monthlyIncludedCredits:
      data?.monthlyIncludedCredits ??
      data?.monthly_included_credits ??
      data?.credits?.monthlyIncluded ??
      null,
    reservedCredits:
      data?.reservedCredits ??
      data?.reserved_credits ??
      data?.credits?.reserved ??
      null,
    usedThisPeriod:
      data?.usedThisPeriod ??
      data?.used_this_period ??
      data?.usage?.usedThisPeriod ??
      null,
    raw: data,
  };

  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Credits loaded", normalized);
  return normalized;
}

export async function openBillingPortalWithActivity() {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Opening billing portal...");

  const response = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Billing portal failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const url = assertRedirectUrl(data, "Billing portal did not return a redirect URL.");

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Billing portal redirect ready", {
    redirectUrl: url,
  });

  window.location.assign(url);
  return { ...data, redirectUrl: url };
}

export async function startCheckoutWithActivity(payload = {}) {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Starting checkout...", payload);

  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Checkout failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason, payload);
    throw new Error(reason);
  }

  const url = assertRedirectUrl(data, "Checkout did not return a redirect URL.");

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Checkout redirect ready", {
    ...payload,
    redirectUrl: url,
  });

  window.location.assign(url);
  return { ...data, redirectUrl: url };
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
