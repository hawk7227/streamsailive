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
import { embeddingCache, embeddingCacheKey } from "./embedCache";

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

async function embedQuery(query: string, workspaceId?: string): Promise<number[] | null> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return null;

  // Check LRU cache before calling OpenAI.
  // Cache hit eliminates the embeddings round-trip on follow-up turns.
  if (workspaceId) {
    const cacheKey = embeddingCacheKey(workspaceId, query);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      console.log(JSON.stringify({ level: "info", event: "EMBED_CACHE_HIT", workspaceId, cacheStats: embeddingCache.stats() }));
      return cached;
    }
  }

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
    const embedding = data.data[0]?.embedding ?? null;

    // Store in cache for subsequent turns in the same conversation
    if (embedding && workspaceId) {
      const cacheKey = embeddingCacheKey(workspaceId, query);
      embeddingCache.set(cacheKey, embedding);
    }

    return embedding;
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

// ── Retrieval diversification ─────────────────────────────────────────────────
//
// Without a per-file cap, the top-N results can be entirely from one file.
// Example: a large types.ts with many embedding-similar chunks can consume
// all 6 slots, leaving nothing for server.ts or auth.ts even when relevant.
//
// Fix: over-fetch (limit × FETCH_MULTIPLIER) candidates, then walk them in
// rank order and skip any file that has already filled MAX_CHUNKS_PER_FILE
// slots. The final result set is capped back to limit.
//
// MAX_CHUNKS_PER_FILE = 2 means at most 2 chunks from any single file.
// For a 6-slot result, up to 6 different files can contribute (or 3 files × 2).
// For a 4-file workspace, worst case is 4 files × 1.5 slots each.
//
// FETCH_MULTIPLIER = 2 means we fetch 12 candidates for a 6-slot result.
// This guarantees we can always fill all slots when enough diverse content exists.
// Increase if workspaces have many files with highly similar content.

const MAX_CHUNKS_PER_FILE = 2;

// Max additional chunks from imported files to append after primary results.
// These are supplementary — they never displace primary results.
const IMPORT_AUGMENT_MAX = 2;
const FETCH_MULTIPLIER    = 2;

type RawResult = { file_id: string; chunk_index: number; content: string; rank: number };

function diversifyByFile(
  results: RawResult[],
  limit: number,
  maxPerFile: number,
): RawResult[] {
  const countByFile = new Map<string, number>();
  const out: RawResult[] = [];

  for (const r of results) {
    const count = countByFile.get(r.file_id) ?? 0;
    if (count >= maxPerFile) continue;
    countByFile.set(r.file_id, count + 1);
    out.push(r);
    if (out.length >= limit) break;
  }

  return out;
}

// ── Public search function ────────────────────────────────────────────────────

// ── Import graph augmentation ─────────────────────────────────────────────────
//
// After primary retrieval, look up files imported by the result files and
// append the top-1 chunk from each imported file not already in results.
// Capped at IMPORT_AUGMENT_MAX to avoid diluting high-signal primary results.
//
// Example:
//   Primary result: auth.ts (2 chunks)
//   auth.ts imports types.ts → types.ts has User/Session type definitions
//   Augmented result: auth.ts (2 chunks) + types.ts (1 chunk)
//   Model now has the type context needed to reason about authentication.

async function augmentWithImportedChunks(
  primaryResults: RawResult[],
  fileIds: string[],
  query: string,
  workspaceId: string,
): Promise<RawResult[]> {
  if (primaryResults.length === 0) return [];

  const admin = createAdminClient();

  // Collect unique from_file_ids already in results
  const resultFileIds = new Set(primaryResults.map((r) => r.file_id));

  // Query file_import_edges for imported files
  const { data: edges } = await admin
    .from("file_import_edges")
    .select("to_file_id")
    .in("from_file_id", [...resultFileIds])
    .eq("workspace_id", workspaceId);

  if (!edges?.length) return [];

  // Collect imported file IDs not already in primary results
  // Only consider files that are in the workspace (fileIds whitelist)
  const workspaceFileSet = new Set(fileIds);
  const augmentFileIds: string[] = [];
  for (const edge of edges) {
    const toId = edge.to_file_id as string;
    if (!resultFileIds.has(toId) && workspaceFileSet.has(toId) && !augmentFileIds.includes(toId)) {
      augmentFileIds.push(toId);
      if (augmentFileIds.length >= IMPORT_AUGMENT_MAX) break;
    }
  }

  if (augmentFileIds.length === 0) return [];

  // Fetch the top-1 chunk from each augmented file using tsvector search.
  // Limit 1 per file — these are supplementary chunks, not primary matches.
  const augmented: RawResult[] = [];
  const safe = query.trim();
  const minRank = Math.min(...primaryResults.map((r) => r.rank));

  for (const augFileId of augmentFileIds) {
    const { data } = await admin
      .from("file_chunks")
      .select("chunk_index, content, file_id")
      .textSearch("search_vec", safe, { type: "websearch" })
      .eq("file_id", augFileId)
      .limit(1);

    if (data?.[0]) {
      const row = data[0] as { chunk_index: number; content: string; file_id: string };
      augmented.push({
        file_id: row.file_id,
        chunk_index: row.chunk_index,
        content: row.content,
        // Rank just below primary results — supplementary, not competing
        rank: minRank - 0.01,
      });
    }
  }

  if (augmented.length > 0) {
    console.log(JSON.stringify({
      level: "info",
      event: "RETRIEVAL_AUGMENTED",
      workspaceId,
      augmentedCount: augmented.length,
      augmentFileIds,
    }));
  }

  return augmented;
}

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

  // Over-fetch candidates so diversification always has enough to fill limit slots.
  const fetchLimit = limit * FETCH_MULTIPLIER;

  // Attempt vector search first
  const queryEmbedding = await embedQuery(safe, workspaceId);
  let rawResults: RawResult[] = [];

  if (queryEmbedding) {
    const vectorRows = await vectorSearch(queryEmbedding, fileIds, fetchLimit);

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
    rawResults = await tsvectorSearch(safe, fileIds, fetchLimit);
  }

  // Apply per-file cap — preserves rank order, limits any single file to
  // MAX_CHUNKS_PER_FILE slots in the final result set.
  const diversified = diversifyByFile(rawResults, limit, MAX_CHUNKS_PER_FILE);

  // Log when the cap was actually hit — tells you how often a single file
  // was dominating results and how many files are now represented.
  const preCapCount = Math.min(rawResults.length, limit);
  if (diversified.length < preCapCount) {
    const filesRepresented = new Set(diversified.map((r) => r.file_id)).size;
    console.log(JSON.stringify({
      level: "info",
      event: "RETRIEVAL_DIVERSIFIED",
      workspaceId,
      candidateCount: rawResults.length,
      preCapCount,
      finalCount: diversified.length,
      filesRepresented,
      maxChunksPerFile: MAX_CHUNKS_PER_FILE,
    }));
  }

  // Augment with chunks from files imported by the primary result files.
  // Appended after primary results — supplementary context, not ranked competitors.
  const augmented = await augmentWithImportedChunks(diversified, fileIds, safe, workspaceId);
  const allResults = [...diversified, ...augmented];

  return allResults.map((r) => ({
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
