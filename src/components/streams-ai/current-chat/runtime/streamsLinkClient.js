const URL_PATTERN_GLOBAL = /https?:\/\/[^\s)\]}>\"]+/gi;

export function extractFirstUrl(input = "") {
  const match = String(input || "").match(URL_PATTERN_GLOBAL);
  return match?.[0] ? match[0].replace(/[.,;!?]+$/, "") : "";
}

function extractUrls(input = "") {
  return (String(input || "").match(URL_PATTERN_GLOBAL) || []).map((value) => value.replace(/[.,;!?]+$/, ""));
}

export function isLinkIntent(message = "", composerMode = "chat") {
  const text = String(message || "").trim();
  const urls = extractUrls(text);

  // Link ingestion is an explicit composer mode only. Normal chat prompts may contain
  // documentation URLs, Markdown links, code samples, or test fixtures and must always
  // continue through the authoritative chat API instead of being intercepted here.
  return composerMode === "url" && urls.length === 1;
}

export async function ingestStreamsLink({ url, intent = "analyze", message = "", signal } = {}) {
  const cleanUrl = url || extractFirstUrl(message);
  if (!cleanUrl) throw new Error("A URL is required.");
  const response = await fetch("/api/streams/link/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: cleanUrl, intent, message }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Link ingest failed.");
  return data;
}
