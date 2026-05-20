export const INGESTION_KINDS = Object.freeze([
  "image",
  "video",
  "audio",
  "document",
  "code",
  "archive",
  "url",
  "youtube",
]);

export const INGESTION_STATUSES = Object.freeze([
  "queued",
  "processing",
  "partial",
  "complete",
  "failed",
  "cancelled",
]);

export function isSupportedIngestionKind(kind) {
  return INGESTION_KINDS.includes(kind);
}

export function createIngestionJobRecord(input = {}) {
  if (!isSupportedIngestionKind(input.kind)) {
    throw new Error(`Unsupported ingestion kind: ${input.kind}`);
  }

  return {
    id: input.id || "",
    kind: input.kind,
    assetId: input.assetId || "",
    sourceUrl: input.sourceUrl || "",
    status: input.status || "queued",
    progress: Number(input.progress || 0),
    metadata: input.metadata || {},
    error: input.error || "",
  };
}
