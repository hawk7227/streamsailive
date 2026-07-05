"use client";

function parseJson(response) {
  return response.json().catch(() => ({}));
}

export async function uploadStreamsAiAssets(files = [], { signal } = {}) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => form.append("file", file));
  const response = await fetch("/api/streams-ai/assets", { method: "POST", body: form, signal });
  const data = await parseJson(response);
  if (!response.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.error || "Upload failed");
  }
  return data;
}

export async function loadStreamsAiMessages(sessionId, { signal } = {}) {
  const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`, { signal });
  const data = await parseJson(response);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || "Could not load this chat history.");
  }
  return data;
}

export async function searchStreamsAiWeb(query, { signal } = {}) {
  const response = await fetch("/api/streams-ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  const data = await parseJson(response);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Web search failed");
  }
  return data;
}

export async function sendStreamsAiMessage(payload, { signal } = {}) {
  const response = await fetch("/api/streams-ai/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    signal,
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new Error(data?.error || `Chat API error: ${response.statusText}`);
  }
  if (!response.body) throw new Error("No response body");
  return response;
}
