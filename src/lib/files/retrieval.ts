/**
 * src/lib/files/retrieval.ts
 *
 * Semantic file retrieval for the assistant context layer.
 *
 * Search strategy:
 *   1. Generate a query embedding (text-embedding-3-small)
 *   2. Attempt vector similarity search via pgvector RPC
 *   3. Fall back to tsvector full-text search if:
 *      - pgvector RPC fails
 *      - No chunks have embeddings yet (freshly uploaded file)
 *      - OPENAI_API_KEY is absent
 *
 * Both paths return the same FileSearchResult shape — callers see no difference.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { OPENAI_API_KEY } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  chunkIndex: number;
  content: string;
  rank: number;
}

// ── Query embedding ───────────────────────────────────────────────────────────

interface EmbeddingResponse {
  data: Array<{ index: number; embedding: number[] }>;
}

async function embedQuery(query: string): Promise<number[] | null> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query.slice(0, 8192), // embedding endpoint limit
        dimensions: 1536,
      }),
      signal: AbortSignal.timeout(5_000), // fast — this is in the hot path
    });

    if (!res.ok) return null;
    const data = await res.json() as EmbeddingResponse;
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ── Vector search ─────────────────────────────────────────────────────────────

interface RpcRow {
  file_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

async function vectorSearch(
  queryEmbedding: number[],
  fileIds: string[],
  limit: number,
): Promise<RpcRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("search_file_chunks_semantic", {
    query_embedding: JSON.stringify(queryEmbedding),
    file_ids: fileIds,
    max_results: limit,
  });

  if (error || !data) return [];
  return data as RpcRow[];
}

// ── tsvector fallback search ──────────────────────────────────────────────────

interface TsRow {
  file_id: string;
  chunk_index: number;
  content: string;
  files: { name?: string; mime_type?: string; workspace_id?: string } | Array<{ name?: string; mime_type?: string; workspace_id?: string }> | null;
}

async function tsvectorSearch(
  query: string,
  fileIds: string[],
  limit: number,
): Promise<Array<{ file_id: string; chunk_index: number; content: string; rank: number }>> {
  const admin = createAdminClient();
  const safe = query.trim();

  if (!safe) return [];

  const { data, error } = await admin
    .from("file_chunks")
    .select("chunk_index, content, file_id")
    .textSearch("search_vec", safe, { type: "websearch" })
    .in("file_id", fileIds)
    .limit(limit);

  if (error || !data) {
    // Last-resort: ilike keyword match
    const { data: fallback } = await admin
      .from("file_chunks")
      .select("chunk_index, content, file_id")
      .in("file_id", fileIds)
      .ilike("content", `%${safe.slice(0, 80)}%`)
      .limit(limit);

    return (fallback ?? []).map((r, i) => ({
      file_id: r.file_id,
      chunk_index: r.chunk_index,
      content: r.content,
      rank: 1 - i * 0.1,
    }));
  }

  return (data).map((r, i) => ({
    file_id: r.file_id,
    chunk_index: r.chunk_index,
    content: r.content,
    rank: 1 - i * 0.08,
  }));
}

// ── Public search function ────────────────────────────────────────────────────

export async function searchWorkspaceFiles(
  workspaceId: string,
  query: string,
  limit = 10,
): Promise<FileSearchResult[]> {
  const admin = createAdminClient();
  const safe = query.trim();
  if (!safe) return [];

  // Resolve file IDs for this workspace
  const { data: files } = await admin
    .from("files")
    .select("id, name, mime_type")
    .eq("workspace_id", workspaceId);

  if (!files?.length) return [];

  const fileIds = files.map((f) => f.id as string);
  const fileMap = new Map(
    files.map((f) => [
      f.id as string,
      { name: f.name as string, mimeType: f.mime_type as string },
    ]),
  );

  // Attempt vector search first
  const queryEmbedding = await embedQuery(safe);
  let rawResults: Array<{ file_id: string; chunk_index: number; content: string; rank: number }> = [];

  if (queryEmbedding) {
    const vectorRows = await vectorSearch(queryEmbedding, fileIds, limit);

    if (vectorRows.length > 0) {
      rawResults = vectorRows.map((r) => ({
        file_id: r.file_id,
        chunk_index: r.chunk_index,
        content: r.content,
        rank: r.similarity,
      }));
    }
  }

  // Fall back to tsvector if vector search returned nothing
  if (rawResults.length === 0) {
    rawResults = await tsvectorSearch(safe, fileIds, limit);
  }

  return rawResults.map((r) => ({
    fileId: r.file_id,
    fileName: fileMap.get(r.file_id)?.name ?? r.file_id,
    mimeType: fileMap.get(r.file_id)?.mimeType ?? "application/octet-stream",
    chunkIndex: r.chunk_index,
    content: r.content,
    rank: r.rank,
  }));
}

// ── Context builder for prompt injection ─────────────────────────────────────

export async function buildFileContext(
  workspaceId: string,
  query: string,
  limit = 6,
): Promise<string> {
  const matches = await searchWorkspaceFiles(workspaceId, query, limit);
  if (!matches.length) return "";

  return matches
    .map(
      (m, i) =>
        `File Match ${i + 1}: ${m.fileName} [chunk ${m.chunkIndex}]\n${m.content.slice(0, 1200)}`,
    )
    .join("\n\n---\n\n");
}
