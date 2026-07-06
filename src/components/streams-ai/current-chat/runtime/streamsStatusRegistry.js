export const SAFE_STREAMS_STATUS_PATTERNS = [
  /^Ready$/,
  /^Ask anything$/,
  /^Chat is ready$/,
  /^Drop files to attach$/,
  /^Upload failed$/,
  /^Files ready$/,
  /^File ready$/,
  /^Loading chat history…$/,
  /^Writing…$/,
  /^Reading attached file…$/,
  /^Reading \d+ attached files…$/,
  /^Inspecting \d+ images?…$/,
  /^Reading \d+ extracted files?…$/,
  /^Checking \d+ attachments?…$/,
  /^Searching the web…$/,
  /^Search complete$/,
  /^Search failed$/,
  /^Generating image…$/,
  /^Image ready$/,
  /^Rendering video…$/,
  /^Video ready$/,
  /^Image failed$/,
  /^Video failed$/,
];

export function normalizeStatusText(value = "") {
  return String(value || "").trim();
}

export function canShowStreamsStatus(value = "") {
  const text = normalizeStatusText(value);
  if (!text) return false;
  return SAFE_STREAMS_STATUS_PATTERNS.some((pattern) => pattern.test(text));
}

export function isVisibleSafeStatus(activity = {}, isStreaming = false) {
  const text = normalizeStatusText(activity?.statusText);
  if (!canShowStreamsStatus(text)) return false;
  if (text === "Ready" || text === "Ask anything" || text === "Chat is ready") return false;
  if (isStreaming) return true;
  return /(?:failed|ready|complete)$/i.test(text) || text === "Upload failed" || text === "Files ready" || text === "File ready";
}
