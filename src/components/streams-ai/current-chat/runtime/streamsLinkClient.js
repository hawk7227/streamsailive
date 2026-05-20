const URL_PATTERN = /https?:\/\/[^\s)\]}>"]+/i;

export function extractFirstUrl(input = "") {
  const match = String(input || "").match(URL_PATTERN);
  return match ? match[0].replace(/[.,;!?]+$/, "") : "";
}

export function isLinkIntent(message = "", composerMode = "chat") {
  if (composerMode === "url") return Boolean(extractFirstUrl(message));
  const text = String(message || "");
  return Boolean(extractFirstUrl(text)) && /\b(analyze|transcribe|recreate|edit|summarize|watch|read|link|youtube|instagram|facebook|tiktok|twitter|x\.com)\b/i.test(text);
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
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || "Link ingest failed.");
  }

  return data;
}
