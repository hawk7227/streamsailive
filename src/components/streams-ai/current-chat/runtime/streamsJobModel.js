export function createJobRecord(input = {}) {
  const createdAt = input.createdAt || new Date(0).toISOString();

  return {
    id: input.id || "",
    userId: input.userId || "",
    workspaceId: input.workspaceId || "",
    kind: input.kind || "unknown",
    status: input.status || "queued",
    progress: Number(input.progress || 0),
    provider: input.provider || "auto",
    inputAssetIds: Array.isArray(input.inputAssetIds) ? input.inputAssetIds : [],
    outputAssetIds: Array.isArray(input.outputAssetIds) ? input.outputAssetIds : [],
    error: input.error || "",
    createdAt,
    updatedAt: input.updatedAt || createdAt,
  };
}

export function jobIsTerminal(job = {}) {
  return ["complete", "failed", "cancelled"].includes(job.status);
}
