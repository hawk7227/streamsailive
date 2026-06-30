import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";

const MAX_TEXT_BYTES = 2_000_000;
const CHUNK_SIZE = 4200;
const CHUNK_OVERLAP = 420;

function serviceClient() {
  return createStreamsAIServiceClient();
}

function db() {
  return streamsAISchema(serviceClient());
}

function now() {
  return new Date().toISOString();
}

function cleanText(value: unknown, max = 12000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function mime(asset: Record<string, any>) {
  return String(asset.mime_type || asset.mimeType || "application/octet-stream").toLowerCase();
}

function isExtractableText(asset: Record<string, any>) {
  const type = mime(asset);
  const name = String(asset.name || "").toLowerCase();
  return (
    type.startsWith("text/") ||
    /json|csv|xml|javascript|typescript|css|html|markdown|yaml|x-yaml|sql/.test(type) ||
    /\.(txt|md|csv|json|xml|html|css|js|jsx|ts|tsx|sql|yaml|yml|log)$/i.test(name)
  );
}

function chunkText(text: string) {
  const chunks: string[] = [];
  const value = cleanText(text, MAX_TEXT_BYTES);
  let index = 0;
  while (index < value.length) {
    const next = value.slice(index, index + CHUNK_SIZE);
    if (next.trim()) chunks.push(next);
    index += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.slice(0, 500);
}

function summarize(text: string, asset: Record<string, any>) {
  const clean = cleanText(text, 2600).replace(/\s+/g, " ");
  if (!clean) return `${asset.name || "Uploaded file"} was uploaded and is ready as a stored asset.`;
  return `${asset.name || "Uploaded file"}: ${clean.slice(0, 1800)}${clean.length > 1800 ? "…" : ""}`;
}

async function patchAssetMetadata(scope: StreamsAIScope, assetId: string, metadata: Record<string, unknown>) {
  try {
    await db()
      .from("streams_ai_assets")
      .update({ metadata, updated_at: now() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", assetId);
  } catch {
    // Metadata updates are supportive; do not break upload response.
  }
}

async function downloadAssetBytes(asset: Record<string, any>) {
  const bucket = asset.storage_bucket || asset.storageBucket;
  const path = asset.storage_path || asset.storagePath;
  if (!bucket || !path) return null;
  const { data, error } = await serviceClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message || "Could not download uploaded asset for processing.");
  if (data.size > MAX_TEXT_BYTES) throw new Error(`File is too large for inline text extraction (${data.size} bytes).`);
  return Buffer.from(await data.arrayBuffer());
}

export async function processUploadedAsset(scope: StreamsAIScope, asset: Record<string, any>) {
  const assetId = String(asset.id || "");
  if (!assetId) return { ok: false, error: "asset id missing" };
  const baseMetadata = { ...(asset.metadata || {}), processingStatus: "queued", processingQueuedAt: now() };
  await patchAssetMetadata(scope, assetId, baseMetadata);

  if (!isExtractableText(asset)) {
    const metadata = {
      ...baseMetadata,
      processingStatus: "ready",
      extractionStatus: "metadata_only",
      summary: `${asset.name || "Uploaded file"} was stored. This file type is available as an attachment/reference asset; text extraction is not available for this MIME type yet.`,
      chunkCount: 0,
      processedAt: now(),
    };
    await patchAssetMetadata(scope, assetId, metadata);
    return { ok: true, status: "metadata_only", chunkCount: 0, summary: metadata.summary };
  }

  try {
    await patchAssetMetadata(scope, assetId, { ...baseMetadata, processingStatus: "processing", extractionStatus: "extracting", processingStartedAt: now() });
    const bytes = await downloadAssetBytes(asset);
    const text = bytes ? bytes.toString("utf8") : "";
    const chunks = chunkText(text);
    const summary = summarize(text, asset);

    await db().from("streams_ai_asset_chunks").delete().eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("asset_id", assetId);

    if (chunks.length) {
      const rows = chunks.map((chunk, index) => ({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: asset.project_id || scope.defaultProjectId || null,
        session_id: asset.session_id || null,
        asset_id: assetId,
        chunk_index: index,
        content: chunk,
        summary: index === 0 ? summary : null,
        token_estimate: Math.ceil(chunk.length / 4),
        metadata: { source: "streams-ai-asset-processing", assetName: asset.name || "Uploaded file", mimeType: mime(asset) },
        created_at: now(),
      }));
      const { error } = await db().from("streams_ai_asset_chunks").insert(rows);
      if (error) throw error;
    }

    const metadata = {
      ...baseMetadata,
      processingStatus: "ready",
      extractionStatus: "ready",
      processedAt: now(),
      chunkCount: chunks.length,
      textPreview: cleanText(text, 6000),
      summary,
    };
    await patchAssetMetadata(scope, assetId, metadata);
    return { ok: true, status: "ready", chunkCount: chunks.length, summary, textPreview: metadata.textPreview };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Asset processing failed");
    await patchAssetMetadata(scope, assetId, { ...baseMetadata, processingStatus: "failed", extractionStatus: "failed", processingError: message, processedAt: now() });
    return { ok: false, status: "failed", error: message };
  }
}

export async function processUploadedAssets(scope: StreamsAIScope, assets: Record<string, any>[]) {
  const results = [];
  for (const asset of assets) results.push(await processUploadedAsset(scope, asset));
  return results;
}

export async function retrieveAssetContext(scope: StreamsAIScope, sessionId: string, query: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(12, options.limit || 8));
  const terms = cleanText(query, 400).toLowerCase().split(/\W+/).filter((term) => term.length > 2).slice(0, 24);
  try {
    let request = db()
      .from("streams_ai_asset_chunks")
      .select("asset_id, chunk_index, content, summary, metadata, created_at")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(200);
    const { data, error } = await request;
    if (error) throw error;
    const ranked = (data || [])
      .map((row) => {
        const haystack = `${row.content || ""} ${row.summary || ""}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { ...row, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { ok: true, chunks: ranked };
  } catch {
    return { ok: false, chunks: [] as Record<string, unknown>[] };
  }
}

export function formatAssetContextForPrompt(chunks: Record<string, any>[]) {
  if (!chunks.length) return "";
  return [
    "Uploaded file context retrieved for this chat:",
    ...chunks.map((chunk, index) => {
      const meta = chunk.metadata || {};
      return `File chunk ${index + 1}: ${meta.assetName || chunk.asset_id || "uploaded file"} · chunk ${chunk.chunk_index}\n${String(chunk.content || "").slice(0, 5000)}`;
    }),
  ].join("\n\n---\n\n");
}
