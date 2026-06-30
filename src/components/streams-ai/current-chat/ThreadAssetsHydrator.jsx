"use client";

import { useEffect } from "react";

const LIBRARY_KEY = "streams-ai.assets.cache.v1";

function normalizeAsset(asset = {}) {
  const url = asset.storageUrl || asset.storage_url || asset.previewUrl || asset.preview_url || asset.publicUrl || asset.public_url || asset.url || "";
  return {
    ...asset,
    id: asset.id || url || asset.name,
    kind: asset.kind || (String(asset.mimeType || asset.mime_type || "").startsWith("image/") ? "image" : String(asset.mimeType || asset.mime_type || "").startsWith("video/") ? "video" : "file"),
    name: asset.name || "Thread asset",
    mimeType: asset.mimeType || asset.mime_type || "application/octet-stream",
    storageUrl: asset.storageUrl || asset.storage_url || url,
    previewUrl: asset.previewUrl || asset.preview_url || url,
    publicUrl: asset.publicUrl || asset.public_url || url,
    url,
    source: asset.source || "thread",
  };
}

function activeSessionId(chatRuntime) {
  if (chatRuntime?.sessionId) return String(chatRuntime.sessionId);
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "streams-ai" && parts[1] ? parts[1] : "";
}

function readLibrary() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLibrary(files) {
  const seen = new Set();
  const unique = files.filter((file) => {
    const key = file?.id || file?.url || file?.storageUrl || file?.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 250);
  window.sessionStorage.setItem(LIBRARY_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event("streams:videos-changed"));
  window.dispatchEvent(new Event("streams:images-changed"));
  window.dispatchEvent(new CustomEvent("streams:thread-assets-restored", { detail: { count: unique.length } }));
}

export default function ThreadAssetsHydrator({ chatRuntime }) {
  useEffect(() => {
    const sessionId = activeSessionId(chatRuntime);
    if (!sessionId) return undefined;
    let cancelled = false;
    async function loadAssets() {
      try {
        const response = await fetch(`/api/streams-ai/assets?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const rows = Array.isArray(data.assets) ? data.assets : Array.isArray(data.files) ? data.files : [];
        if (cancelled || !rows.length) return;
        const hydrated = rows.map(normalizeAsset);
        writeLibrary([...hydrated, ...readLibrary()]);
      } catch {
        // Thread assets are supportive context; do not block chat if unavailable.
      }
    }
    loadAssets();
    return () => {
      cancelled = true;
    };
  }, [chatRuntime?.sessionId]);

  return null;
}
