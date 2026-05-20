function apiUrl(path) {
  const configured = import.meta.env?.VITE_STREAMS_API_BASE_URL || "";
  if (!configured) return path;
  return `${configured.replace(/\/$/, "")}${path}`;
}

function normalizeMessages(messages = [], userMessage = "") {
  const list = Array.isArray(messages) ? messages : [];
  const normalized = list
    .filter((message) => message && message.role)
    .map((message) => ({
      role: message.role,
      content: String(message.content || message.text || ""),
    }))
    .filter((message) => message.content.trim());

  const last = normalized[normalized.length - 1];

  if (userMessage && !(last?.role === "user" && last.content === userMessage)) {
    normalized.push({
      role: "user",
      content: userMessage,
    });
  }

  return normalized;
}

function extractTextFromJson(value) {
  if (!value) return "";
  if (typeof value === "string") return value;

  if (typeof value.text === "string") return value.text;
  if (typeof value.message === "string") return value.message;
  if (typeof value.content === "string") return value.content;
  if (typeof value.output_text === "string") return value.output_text;
  if (typeof value.response === "string") return value.response;
  if (typeof value.assistant === "string") return value.assistant;
  if (typeof value.error === "string") return value.error;

  if (Array.isArray(value.output)) return value.output.map((item) => extractTextFromJson(item)).filter(Boolean).join("");
  if (Array.isArray(value.content)) return value.content.map((item) => extractTextFromJson(item)).filter(Boolean).join("");

  if (Array.isArray(value.messages)) {
    const assistant = [...value.messages].reverse().find((message) => message?.role === "assistant");
    return extractTextFromJson(assistant);
  }

  if (typeof value.delta === "string") return value.delta;
  if (typeof value.token === "string") return value.token;

  return "";
}

async function readErrorText(response) {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await response.json();
      const text = body.error || body.message || body.detail || body.blockedReason || extractTextFromJson(body);
      return text ? String(text) : JSON.stringify(body).slice(0, 500);
    }

    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function emitText(onEvent, text) {
  if (!text) return;

  // New normalized event used by the migrated chat runtime.
  onEvent?.({ type: "text_delta", delta: text });

  // Backward-compatible event shape used by the older working Streams SSE chat.
  onEvent?.({
    type: "response",
    token: text,
    text,
    data: { token: text, text },
  });
}

function emitDone(onEvent, data = {}) {
  onEvent?.({ type: "done", ...data });
}

function emitError(onEvent, message) {
  onEvent?.({ type: "error", error: message, message });
}

function emitActivity(onEvent, data) {
  onEvent?.({
    type: "activity",
    ...data,
    data
  });
}

async function readPlainOrJson(response, onEvent) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await response.json();
    const text = extractTextFromJson(body);

    if (!text) {
      throw new Error("Chat backend returned JSON but no assistant text.");
    }

    emitText(onEvent, text);
    emitDone(onEvent, { data: body });

    return { ok: true, text, body };
  }

  const text = await response.text();

  if (!text.trim()) {
    throw new Error("Chat backend returned an empty response.");
  }

  emitText(onEvent, text);
  emitDone(onEvent);

  return { ok: true, text };
}

function parseSsePayload(raw) {
  const value = String(raw || "").trim();

  if (!value || value === "[DONE]") return { type: "done" };

  try {
    return JSON.parse(value);
  } catch {
    return { type: "text_delta", delta: value };
  }
}

function parseSsePart(part) {
  const lines = part.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const eventName = eventLine ? eventLine.slice(6).trim() : "message";
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  return dataLines.map((line) => ({
    eventName,
    payload: parseSsePayload(line)
  }));
}

function handleSseEvent({ eventName, payload }, onEvent) {
  if (eventName === "activity") {
    emitActivity(onEvent, payload);
    return "";
  }

  if (eventName === "response") {
    const text = payload?.token || payload?.delta || payload?.text || payload?.content || extractTextFromJson(payload);
    emitText(onEvent, text);
    return text || "";
  }

  if (eventName === "artifact") {
    onEvent?.({ type: "artifact", ...payload, data: payload });
    return "";
  }

  if (eventName === "complete") {
    emitDone(onEvent, { data: payload });
    return "__DONE__";
  }

  if (eventName === "error") {
    const message = payload?.message || payload?.error || "Chat backend returned an error.";
    emitError(onEvent, message);
    throw new Error(message);
  }

  if (payload?.type === "done") {
    emitDone(onEvent, { data: payload });
    return "__DONE__";
  }

  if (payload?.type === "error") {
    const message = payload.error || payload.message || "Chat backend returned an error.";
    emitError(onEvent, message);
    throw new Error(message);
  }

  const text = payload?.delta || payload?.text || payload?.content || payload?.output_text || extractTextFromJson(payload);
  emitText(onEvent, text);
  return text || "";
}

async function readSse(response, onEvent) {
  const reader = response.body?.getReader?.();

  if (!reader) {
    return readPlainOrJson(response, onEvent);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || "";

    for (const part of parts) {
      for (const event of parseSsePart(part)) {
        const result = handleSseEvent(event, onEvent);
        if (result === "__DONE__") return { ok: true, text: output };
        output += result;
      }
    }
  }

  if (buffer.trim()) {
    for (const event of parseSsePart(buffer)) {
      const result = handleSseEvent(event, onEvent);
      if (result === "__DONE__") return { ok: true, text: output };
      output += result;
    }
  }

  if (!output.trim()) {
    throw new Error("Chat backend stream ended without assistant text.");
  }

  emitDone(onEvent);

  return { ok: true, text: output };
}

export async function sendStreamsChatMessage({
  message,
  messages = [],
  attachments = [],
  mode = "chat",
  provider = "auto",
  signal,
  onEvent,
} = {}) {
  const userMessage = String(message || "").trim();

  if (!userMessage) {
    throw new Error("Message is required.");
  }

  const normalizedMessages = normalizeMessages(messages, userMessage);

  const response = await fetch(apiUrl("/api/streams-ai/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json, text/plain",
    },
    body: JSON.stringify({
      message: userMessage,
      input: userMessage,
      prompt: userMessage,
      text: userMessage,
      content: userMessage,
      messages: normalizedMessages,
      attachments,
      mode,
      provider,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await readErrorText(response);
    throw new Error(`Chat backend failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    return readSse(response, onEvent);
  }

  return readPlainOrJson(response, onEvent);
}

export function isStreamsChatConfigured() {
  return true;
}
