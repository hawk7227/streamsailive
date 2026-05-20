const CHAT_SESSIONS_KEY = "streams:standalone:chat-sessions";
const CURRENT_CHAT_ID_KEY = "streams:standalone:current-chat-id";
const IMAGE_GALLERY_KEY = "streams:standalone:image-gallery";
const VIDEO_GALLERY_KEY = "streams:standalone:video-gallery";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
  const sessions = readJson(CHAT_SESSIONS_KEY, []);
  return [...sessions].sort((a, b) => {
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
}

export function getChatSession(id) {
  if (!id) return null;
  return listChatSessions().find((session) => session.id === id) || null;
}

export function getCurrentSessionId() {
  return localStorage.getItem(CURRENT_CHAT_ID_KEY) || "";
}

export function setCurrentSessionId(id) {
  if (!id) return;
  localStorage.setItem(CURRENT_CHAT_ID_KEY, id);
}

export function createChatSession(seed = {}) {
  const createdAt = nowIso();
  const session = {
    id: seed.id || makeId("chat"),
    title: seed.title || "New chat",
    createdAt,
    updatedAt: createdAt,
    messages: Array.isArray(seed.messages) ? seed.messages : [],
  };

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

  writeJson(CHAT_SESSIONS_KEY, next);
  setCurrentSessionId(normalized.id);
  return normalized;
}

export function deleteChatSession(id) {
  if (!id) return;
  const next = listChatSessions().filter((item) => item.id !== id);
  writeJson(CHAT_SESSIONS_KEY, next);

  if (getCurrentSessionId() === id) {
    if (next[0]?.id) {
      setCurrentSessionId(next[0].id);
    } else {
      localStorage.removeItem(CURRENT_CHAT_ID_KEY);
    }
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

function galleryKey(kind) {
  return kind === "videos" ? VIDEO_GALLERY_KEY : IMAGE_GALLERY_KEY;
}

export function listMedia(kind) {
  const items = readJson(galleryKey(kind), []);
  return [...items].sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export function addMediaItem(kind, item) {
  if (!item?.url) return null;

  const current = listMedia(kind);
  const normalized = {
    id: item.id || makeId(kind === "videos" ? "video" : "image"),
    kind,
    title: item.title || item.prompt || (kind === "videos" ? "Generated video" : "Generated image"),
    prompt: item.prompt || "",
    url: item.url,
    mimeType: item.mimeType || "",
    generationId: item.generationId || "",
    createdAt: item.createdAt || nowIso(),
  };

  const next = [normalized, ...current].slice(0, 200);
  writeJson(galleryKey(kind), next);
  return normalized;
}

export function deleteMediaItem(kind, id) {
  const next = listMedia(kind).filter((item) => item.id !== id);
  writeJson(galleryKey(kind), next);
}
