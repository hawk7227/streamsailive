const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_STREAMS_API_BASE_URL || "";

function apiUrl(path) {
  return `${DEFAULT_BASE}${path}`;
}

async function readJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || fallbackMessage || `Request failed: ${response.status}`);
  }
  return data;
}

export async function listStreamsSessions({ limit = 50 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  const response = await fetch(apiUrl(`/api/streams-ai/sessions?${params.toString()}`), {
    cache: "no-store",
  });

  const data = await readJson(response, "Failed to load STREAMS AI sessions.");
  return data.sessions || data.data || [];
}

export async function createStreamsSession({ title = "New STREAMS AI chat", projectId = null, metadata = {} } = {}) {
  const response = await fetch(apiUrl("/api/streams-ai/sessions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, projectId, metadata }),
  });

  const data = await readJson(response, "Failed to create STREAMS AI session.");
  return data.session || data.data || data;
}

export async function getStreamsSessionMessages({ sessionId }) {
  if (!sessionId) throw new Error("sessionId is required.");

  const response = await fetch(apiUrl(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`), {
    cache: "no-store",
  });

  const data = await readJson(response, "Failed to load STREAMS AI messages.");
  return data.messages || [];
}

export async function createStreamsSessionTitle({ sessionId, content }) {
  if (!sessionId) throw new Error("sessionId is required.");
  if (!String(content || "").trim()) throw new Error("content is required.");

  const response = await fetch(apiUrl("/api/streams-ai/sessions/title"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, content }),
  });

  const data = await readJson(response, "Failed to create STREAMS AI session title.");
  return data.title || data.session?.title || "";
}
