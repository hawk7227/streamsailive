const GATE_ENDPOINT = "/api/streams-ai/usage-gate";

function cleanMessage(value) {
  if (!value || typeof value !== "string") return "This action needs account usage approval before it can run.";
  return value
    .replace(/\bStripe\b/gi, "billing")
    .replace(/\bAPI\b/g, "account control")
    .replace(/schema cache/gi, "account setup")
    .replace(/\/api\/[\w\-/]+/gi, "account service")
    .replace(/streams_ai_[a-z_]+/gi, "account record")
    .replace(/provider/gi, "service")
    .replace(/backend/gi, "account system");
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function requestStreamsUsageApproval({ featureKey, stage = "final", credits, relatedSessionId, signal } = {}) {
  const payload = {
    featureKey,
    stage,
    ...(typeof credits === "number" ? { credits } : {}),
    ...(relatedSessionId ? { relatedSessionId } : {}),
  };

  const first = await fetch(GATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
    signal,
  });
  const firstData = await readJson(first);

  if (first.ok && firstData?.allowed) return { ok: true, gate: firstData };

  if (firstData?.requiresConfirmation) {
    const message = cleanMessage(firstData.message || "This action can continue with paid usage credits.");
    const accepted = typeof window !== "undefined" && window.confirm(`${message}\n\nContinue with paid usage credits?`);
    if (!accepted) {
      return {
        ok: false,
        cancelled: true,
        gate: firstData,
        message: "Generation was not started. Usage-credit confirmation was cancelled.",
      };
    }

    const confirmed = await fetch(GATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...payload, confirmPaidUsage: true }),
      signal,
    });
    const confirmedData = await readJson(confirmed);
    if (confirmed.ok && confirmedData?.allowed) return { ok: true, gate: confirmedData };
    return {
      ok: false,
      gate: confirmedData,
      message: cleanMessage(confirmedData?.message || confirmedData?.error || "Usage approval failed."),
    };
  }

  return {
    ok: false,
    gate: firstData,
    message: cleanMessage(firstData?.message || firstData?.error || "Usage approval failed."),
  };
}
