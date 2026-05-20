const CURRENT_CHAT_ID_KEY = "streams-ai:current-chat-id";
const SESSION_CACHE_KEY = "streams-ai:sessions.cache.v1";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function readCache() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(value) {
  try {
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(value));
  } catch {
    // cache only
  }
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "STREAMS AI request failed");
  return data;
}

function normalizeMessage(row = {}) {
  return {
    id: row.id || makeId("msg"),
    role: row.role || "assistant",
    content: row.content || "",
    status: row.status || "complete",
    createdAt: row.created_at || row.createdAt || nowIso(),
    ...row.metadata,
  };
}

function normalizeSession(row = {}, messages = []) {
  return {
    id: row.id || makeId("chat"),
    title: row.title || buildSessionTitle(messages) || "New chat",
    createdAt: row.created_at || row.createdAt || nowIso(),
    updatedAt: row.updated_at || row.updatedAt || nowIso(),
    messages: Array.isArray(messages) ? messages.map(normalizeMessage) : [],
  };
}

async function refreshSessionsCache() {
  const data = await api("/api/streams-ai/sessions");
  const sessions = Array.isArray(data.sessions) ? data.sessions.map((row) => normalizeSession(row)) : [];
  writeCache(sessions);
  if (!getCurrentSessionId() && sessions[0]?.id) setCurrentSessionId(sessions[0].id);
  return sessions;
}

async function refreshSessionMessages(sessionId) {
  if (!sessionId) return null;
  const data = await api(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`);
  const messages = Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : [];
  const sessions = listChatSessions();
  const existing = sessions.find((item) => item.id === sessionId);
  if (!existing) return null;
  const updated = { ...existing, messages };
  writeCache(sessions.map((item) => item.id === sessionId ? updated : item));
  return updated;
}

export function buildSessionTitle(messages = []) {
  const firstUser = messages.find(
    (item) => item?.role === "user" && typeof item?.content === "string" && item.content.trim()
  );

  if (!firstUser) return "New chat";

  const clean = firstUser.content.replace(/\s+/g, " ").trim();
  if (clean.length <= 58) return clean;
  return `${clean.slice(0, 58)}…`;
}

export function listChatSessions() {
  refreshSessionsCache().catch(() => {});
  const sessions = readCache();
  return [...sessions].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

export function getChatSession(id) {
  if (!id) return null;
  const cached = listChatSessions().find((session) => session.id === id) || null;
  refreshSessionMessages(id).catch(() => {});
  return cached;
}

export function getCurrentSessionId() {
  try {
    return window.sessionStorage.getItem(CURRENT_CHAT_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function setCurrentSessionId(id) {
  if (!id) return;
  try {
    window.sessionStorage.setItem(CURRENT_CHAT_ID_KEY, id);
  } catch {
    // cache only
  }
}

export function createChatSession(seed = {}) {
  const createdAt = nowIso();
  const session = {
    id: seed.id || makeId("pending_chat"),
    title: seed.title || "New chat",
    createdAt,
    updatedAt: createdAt,
    messages: Array.isArray(seed.messages) ? seed.messages : [],
  };

  api("/api/streams-ai/sessions", {
    method: "POST",
    body: JSON.stringify({ title: session.title }),
  })
    .then((data) => {
      if (data.session?.id) {
        const persisted = normalizeSession(data.session, session.messages);
        upsertChatSession(persisted);
        setCurrentSessionId(persisted.id);
      }
    })
    .catch(() => {});

  upsertChatSession(session);
  setCurrentSessionId(session.id);
  return session;
}

export function ensureCurrentChatSession() {
  const currentId = getCurrentSessionId();
  const existing = getChatSession(currentId);
  if (existing) return existing;

  const sessions = listChatSessions();
  if (sessions.length > 0) {
    setCurrentSessionId(sessions[0].id);
    return sessions[0];
  }

  return createChatSession();
}

export function upsertChatSession(session) {
  if (!session?.id) return null;

  const sessions = listChatSessions();
  const existing = sessions.find((item) => item.id === session.id);

  const normalized = {
    id: session.id,
    title: session.title || buildSessionTitle(session.messages || []) || "New chat",
    createdAt: session.createdAt || existing?.createdAt || nowIso(),
    updatedAt: session.updatedAt || nowIso(),
    messages: Array.isArray(session.messages) ? session.messages : [],
  };

  const next = existing
    ? sessions.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...sessions];

  writeCache(next);
  setCurrentSessionId(normalized.id);

  if (!String(normalized.id).startsWith("pending_")) {
    api("/api/streams-ai/sessions", {
      method: "PATCH",
      body: JSON.stringify({ sessionId: normalized.id, title: normalized.title }),
    }).catch(() => {});
  }

  return normalized;
}

export function deleteChatSession(id) {
  if (!id) return;
  const next = listChatSessions().filter((item) => item.id !== id);
  writeCache(next);

  if (getCurrentSessionId() === id) {
    if (next[0]?.id) {
      setCurrentSessionId(next[0].id);
    } else {
      try {
        window.sessionStorage.removeItem(CURRENT_CHAT_ID_KEY);
      } catch {
        // cache only
      }
    }
  }

  if (!String(id).startsWith("pending_")) {
    api("/api/streams-ai/sessions", {
      method: "PATCH",
      body: JSON.stringify({ sessionId: id, status: "archived" }),
    }).catch(() => {});
  }
}

export function searchChatSessions(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return listChatSessions();

  return listChatSessions().filter((session) => {
    const haystack = [
      session.title || "",
      ...(session.messages || []).map((m) => m?.content || ""),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function listMedia(kind) {
  return [];
}

export function addMediaItem(kind, item) {
  return item || null;
}

export function deleteMediaItem(kind, id) {
  return undefined;
}
