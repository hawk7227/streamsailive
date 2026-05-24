const ASSET_CACHE_KEY = "streams-ai.assets.cache.v1";

function safeReadCache() {
  try {
    const raw = window.sessionStorage.getItem(ASSET_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeWriteCache(value) {
  try {
    window.sessionStorage.setItem(ASSET_CACHE_KEY, JSON.stringify(value));
  } catch {
    // cache only
  }
}

function normalizeAsset(row = {}) {
  const url = row.public_url || row.publicUrl || row.url || row.previewUrl || row.storageUrl || "";
  return {
    id: row.id || row.asset_id || url || row.name,
    name: row.name || "Asset",
    kind: row.kind || (String(row.mime_type || row.mimeType || "").startsWith("image/") ? "image" : String(row.mime_type || row.mimeType || "").startsWith("video/") ? "video" : "file"),
    mimeType: row.mime_type || row.mimeType || "",
    sizeBytes: row.size_bytes || row.sizeBytes || 0,
    storageBucket: row.storage_bucket || row.storageBucket || "",
    storagePath: row.storage_path || row.storagePath || "",
    publicUrl: row.public_url || row.publicUrl || "",
    storageUrl: url,
    previewUrl: url,
    url,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    metadata: row.metadata || {},
  };
}

let lastRefreshTime = 0;
let refreshPromise = null;

async function refreshAssetCache() {
  const now = Date.now();
  if (now - lastRefreshTime < 6000) {
    return safeReadCache();
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/streams-ai/assets");
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ok !== false) {
        const assets = Array.isArray(data.assets) ? data.assets.map(normalizeAsset) : [];
        safeWriteCache(assets);
        lastRefreshTime = Date.now();
        window.dispatchEvent(new Event("streams:videos-changed"));
        window.dispatchEvent(new Event("streams:images-changed"));
        return assets;
      }
    } catch {
      // ignore
    } finally {
      refreshPromise = null;
    }
    return safeReadCache();
  })();

  return refreshPromise;
}

function listCachedByKind(kind) {
  return safeReadCache().filter((item) => item.kind === kind);
}

export function listGeneratedImages() {
  refreshAssetCache().catch(() => {});
  return listCachedByKind("image");
}

export function addGeneratedImage(image) {
  const item = normalizeAsset({ ...image, kind: "image" });
  const next = [item, ...safeReadCache().filter((entry) => entry.id !== item.id)].slice(0, 250);
  safeWriteCache(next);
  window.dispatchEvent(new Event("streams:images-changed"));
  return next.filter((entry) => entry.kind === "image");
}

export function updateGeneratedImage(id, patch) {
  const next = safeReadCache().map((item) => item.id === id ? { ...item, ...patch } : item);
  safeWriteCache(next);
  window.dispatchEvent(new Event("streams:images-changed"));
  return next.filter((entry) => entry.kind === "image");
}

export function listGeneratedVideos() {
  refreshAssetCache().catch(() => {});
  return listCachedByKind("video");
}

export function addGeneratedVideo(video) {
  const item = normalizeAsset({ ...video, kind: "video" });
  const next = [item, ...safeReadCache().filter((entry) => entry.id !== item.id)].slice(0, 250);
  safeWriteCache(next);
  window.dispatchEvent(new Event("streams:videos-changed"));
  return next.filter((entry) => entry.kind === "video");
}

export function updateGeneratedVideo(id, patch) {
  const next = safeReadCache().map((item) => item.id === id ? { ...item, ...patch } : item);
  safeWriteCache(next);
  window.dispatchEvent(new Event("streams:videos-changed"));
  return next.filter((entry) => entry.kind === "video");
}

export function listLibraryFiles() {
  refreshAssetCache().catch(() => {});
  return safeReadCache();
}

export function upsertLibraryFile(file) {
  const item = normalizeAsset(file);
  const next = [item, ...safeReadCache().filter((entry) => entry.id !== item.id)].slice(0, 250);
  safeWriteCache(next);
  window.dispatchEvent(new Event("streams:videos-changed"));
  window.dispatchEvent(new Event("streams:images-changed"));
  window.dispatchEvent(new CustomEvent("streams:chat-upload-complete", { detail: { assets: [item] } }));
  return next;
}

export function buildShareChatPayload(session) {
  const title = session?.title || "Streams chat";
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const text = messages
    .map((message) => {
      const role = message.role === "user" ? "User" : "Assistant";
      const body = message.content || message.generatedImage?.url || message.generatedVideoUrl || "";
      return `${role}: ${body}`;
    })
    .join("\n\n")
    .trim();

  return { title, text };
}

export function deleteLibraryFile(id) {
  const next = safeReadCache().filter((entry) => entry.id !== id);
  safeWriteCache(next);
  window.dispatchEvent(new Event("streams:videos-changed"));
  window.dispatchEvent(new Event("streams:images-changed"));
  return next;
}
