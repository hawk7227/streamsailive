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

export function normalizeStreamsError(error, mode = "chat") {
  const raw = rawErrorText(error);
  const jsonError = extractJsonError(raw);
  const joined = `${raw}\n${jsonError}`;
  const lower = joined.toLowerCase();

  if (lower.includes("fal_key") || lower.includes("fal key")) {
    return {
      title: "Provider key missing",
      message: "FAL_KEY is not configured on the server. Current image/video generation needs FAL_KEY loaded in the dev server or deployment environment.",
      code: "missing_fal_key",
      retryable: false,
      raw,
    };
  }

  if (lower.includes("openai_api_key") || lower.includes("openai api key")) {
    return {
      title: "OpenAI key missing",
      message: "OPENAI_API_KEY is not configured on the server. OpenAI Images cannot run until that key is loaded.",
      code: "missing_openai_key",
      retryable: false,
      raw,
    };
  }

  if (raw.includes("Unauthorized") || raw.includes("401")) {
    return {
      title: "Access issue",
      message: "This request was not authorized. The test user or workspace is not configured correctly.",
      code: "unauthorized",
      retryable: false,
      raw,
    };
  }

  if (raw.includes("mode must be")) {
    return {
      title: "Invalid video mode",
      message: "The video request used the wrong generation mode. Use text-to-video mode for normal video prompts.",
      code: "invalid_video_mode",
      retryable: false,
      raw,
    };
  }

  if (lower.includes("failed to fetch")) {
    return {
      title: "Connection failed",
      message: "The app could not reach the backend route. Check that the dev server and API proxy are running.",
      code: "network_failed",
      retryable: true,
      raw,
    };
  }

  if (lower.includes("timed out")) {
    return {
      title: "Generation timed out",
      message: "The provider did not finish in time. You can retry the request.",
      code: "timeout",
      retryable: true,
      raw,
    };
  }

  const providerMessage = jsonError || "The request did not complete successfully.";

  return {
    title: mode === "image" ? "Image request failed" : mode === "video" ? "Video request failed" : "Request failed",
    message: providerMessage,
    code: "unknown",
    retryable: true,
    raw,
  };
}

export function formatErrorForChat(errorInfo) {
  if (!errorInfo) return "Request failed.";
  return `${errorInfo.title}\n\n${errorInfo.message}`;
}
