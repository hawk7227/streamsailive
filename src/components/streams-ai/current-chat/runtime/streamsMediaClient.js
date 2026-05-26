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

export function normalizeStreamsMediaAsset(asset = {}) {
  const url = asset.url || asset.publicUrl || asset.public_url || asset.previewUrl || asset.storageUrl || "";
  const mimeType = asset.mimeType || asset.mime_type || "";
  const kind =
    asset.kind ||
    (mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "file");

  return {
    ...asset,
    id: asset.id || asset.asset_id || url || asset.name,
    kind,
    name: asset.name || asset.title || "STREAMS asset",
    mimeType,
    sizeBytes: asset.sizeBytes || asset.size_bytes || 0,
    storageBucket: asset.storageBucket || asset.storage_bucket || "",
    storagePath: asset.storagePath || asset.storage_path || "",
    publicUrl: asset.publicUrl || asset.public_url || url,
    previewUrl: asset.previewUrl || asset.preview_url || url,
    storageUrl: asset.storageUrl || asset.storage_url || url,
    url,
    createdAt: asset.createdAt || asset.created_at || "",
    metadata: asset.metadata || {},
  };
}

export async function listStreamsMediaAssets({ kind, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  params.set("limit", String(limit));

  const response = await fetch(apiUrl(`/api/streams-ai/assets?${params.toString()}`), {
    cache: "no-store",
  });

  const data = await readJson(response, "Failed to load STREAMS AI media assets.");
  return (data.assets || data.files || []).map(normalizeStreamsMediaAsset);
}

export async function uploadStreamsMediaAssets(files, metadata = {}) {
  const selected = Array.from(files || []);
  if (!selected.length) return [];

  const form = new FormData();
  selected.forEach((file) => form.append("file", file));
  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });

  const response = await fetch(apiUrl("/api/streams-ai/assets"), {
    method: "POST",
    body: form,
  });

  const data = await readJson(response, "Failed to upload STREAMS AI media assets.");
  return (data.assets || data.files || []).map(normalizeStreamsMediaAsset);
}

export async function createStreamsMediaAsset(asset) {
  if (!asset?.name?.trim?.() && !asset?.url && !asset?.publicUrl) {
    throw new Error("Asset name or URL is required.");
  }

  const response = await fetch(apiUrl("/api/streams-ai/assets"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(asset),
  });

  const data = await readJson(response, "Failed to create STREAMS AI media asset.");
  return normalizeStreamsMediaAsset(data.asset || data);
}

export function getStreamsAssetDownloadUrl(assetId, { download = false } = {}) {
  if (!assetId) throw new Error("assetId is required.");
  const params = new URLSearchParams({ assetId });
  if (download) params.set("download", "1");
  return apiUrl(`/api/streams-ai/assets/download?${params.toString()}`);
}
