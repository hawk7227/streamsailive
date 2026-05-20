export function createAssetRecord(input = {}) {
  const createdAt = input.createdAt || new Date(0).toISOString();

  return {
    id: input.id || "",
    userId: input.userId || "",
    workspaceId: input.workspaceId || "",
    kind: input.kind || "file",
    source: input.source || "upload",
    mimeType: input.mimeType || "",
    sizeBytes: Number(input.sizeBytes || 0),
    storageBucket: input.storageBucket || "",
    storagePath: input.storagePath || "",
    previewUrl: input.previewUrl || "",
    width: input.width || null,
    height: input.height || null,
    duration: input.duration || null,
    status: input.status || "created",
    createdAt,
    updatedAt: input.updatedAt || createdAt,
  };
}

export function isDurableAsset(asset = {}) {
  return Boolean(asset.storageBucket && asset.storagePath);
}
