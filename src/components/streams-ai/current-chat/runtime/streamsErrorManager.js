function rawErrorText(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractJsonError(raw) {
  const text = String(raw || "").trim();
  const firstBrace = text.indexOf("{");
  if (firstBrace < 0) return "";
  try {
    const parsed = JSON.parse(text.slice(firstBrace));
    return parsed?.error || parsed?.message || parsed?.blockedReason || "";
  } catch {
    return "";
  }
}

const USER_ERROR_COPY = {
  service_unavailable: {
    title: "Streams is temporarily unavailable",
    message: "Your message is safe. Please try again in a moment.",
    retryable: true,
  },
  service_not_ready: {
    title: "Streams is not ready yet",
    message: "This workspace is still being connected. Please try again shortly.",
    retryable: false,
  },
  generation_unavailable: {
    title: "Generation is temporarily unavailable",
    message: "Your prompt was not lost. Please try again in a moment.",
    retryable: true,
  },
  access_issue: {
    title: "Permission needed",
    message: "Streams could not verify access for that request. Refresh the page or sign in again, then retry.",
    retryable: true,
  },
  network_failed: {
    title: "Connection interrupted",
    message: "Streams could not complete the request. Check your connection and try again.",
    retryable: true,
  },
  timeout: {
    title: "This is taking longer than expected",
    message: "The request did not finish in time. Please try again.",
    retryable: true,
  },
  invalid_request: {
    title: "That request needs an adjustment",
    message: "Adjust the prompt or selected mode and try again.",
    retryable: false,
  },
  unknown: {
    title: "Something went wrong",
    message: "The request did not complete. Please try again.",
    retryable: true,
  },
};

function makeUserError(code, raw, extra = {}) {
  const base = USER_ERROR_COPY[code] || USER_ERROR_COPY.unknown;
  return { ...base, ...extra, code, raw, userFacing: true };
}

export function normalizeStreamsError(error, mode = "chat") {
  const raw = rawErrorText(error);
  const jsonError = extractJsonError(raw);
  const joined = `${raw}\n${jsonError}`;
  const lower = joined.toLowerCase();

  if (lower.includes("api key") || lower.includes("not configured") || lower.includes("missing configuration")) {
    return makeUserError("service_not_ready", raw);
  }

  if (lower.includes("generation provider") || lower.includes("image failed") || lower.includes("video failed") || lower.includes("generation failed")) {
    return makeUserError("generation_unavailable", raw, {
      title: mode === "image" ? "Image generation is temporarily unavailable" : mode === "video" ? "Video generation is temporarily unavailable" : USER_ERROR_COPY.generation_unavailable.title,
    });
  }

  if (raw.includes("Unauthorized") || raw.includes("401") || lower.includes("permission") || lower.includes("auth")) {
    return makeUserError("access_issue", raw);
  }

  if (raw.includes("mode must be") || lower.includes("invalid") || lower.includes("bad request") || raw.includes("400")) {
    return makeUserError("invalid_request", raw);
  }

  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("connection")) {
    return makeUserError("network_failed", raw);
  }

  if (lower.includes("timed out") || lower.includes("timeout") || raw.includes("504")) {
    return makeUserError("timeout", raw);
  }

  if (lower.includes("provider error") || lower.includes("provider response") || raw.includes("429") || raw.includes("500") || raw.includes("502") || raw.includes("503")) {
    return makeUserError("service_unavailable", raw);
  }

  return makeUserError("unknown", raw);
}

export function formatErrorForChat(errorInfo) {
  if (!errorInfo) return `${USER_ERROR_COPY.unknown.title}\n\n${USER_ERROR_COPY.unknown.message}`;
  return `${errorInfo.title}\n\n${errorInfo.message}`;
}
