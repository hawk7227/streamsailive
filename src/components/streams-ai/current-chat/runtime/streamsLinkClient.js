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
  if (composerMode === "url") return urls.length === 1;
  if (urls.length !== 1) return false;
  if (/```|\|\s*[-:]+\s*\||renderer test|syntax test|expected .*behavior|respond with the following/i.test(text)) return false;
  if (text.length > 700 || (text.match(/\n/g) || []).length > 8) return false;
  return /^(?:please\s+)?(?:analyze|transcribe|recreate|edit|summarize|watch|read|open|inspect)\b[\s\S]{0,220}https?:\/\//i.test(text)
    || /^https?:\/\/\S+$/i.test(text)
    || /^(?:analyze|summarize|read)\s+(?:this\s+)?link\b/i.test(text);
}

export async function ingestStreamsLink({ url, intent = "analyze", message = "", signal } = {}) {
  const cleanUrl = url || extractFirstUrl(message);
  if (!cleanUrl) throw new Error("A URL is required.");
  const response = await fetch("/api/streams/link/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: cleanUrl, intent, message }), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Link ingest failed.");
  return data;
}
