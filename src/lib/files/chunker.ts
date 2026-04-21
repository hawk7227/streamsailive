/**
 * src/lib/files/chunker.ts
 *
 * Structure-aware file chunking + semantic embedding indexing.
 *
 * Splitting strategy (by file kind):
 *   code (.ts/.tsx/.js/.jsx/.py/.go/.rs/.java) → split by function/class/export boundaries
 *   logs (.log/.txt with timestamp patterns)   → split by log-event boundaries
 *   everything else                             → overlapping word-based windows
 *
 * After chunks are written to file_chunks, embeddings are generated in a
 * single batched OpenAI API call and written back. If embedding generation
 * fails, chunks remain searchable via tsvector fallback.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { OPENAI_API_KEY } from "@/lib/env";

// ── Config ────────────────────────────────────────────────────────────────────

const WORD_CHUNK_SIZE = 384;   // ~512 tokens
const WORD_OVERLAP = 48;       // overlap to preserve context across boundaries
const WORDS_PER_TOKEN = 0.75;
const EMBED_BATCH_SIZE = 96;   // max texts per OpenAI embedding request
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMENSIONS = 1536;
const MAX_CHUNK_CHARS = 6000;  // hard cap per chunk to stay within embedding limits

// ── Code structure splitter ───────────────────────────────────────────────────

// Matches the start of a top-level declaration in TS/JS/Python/Go/Rust/Java.
// Captures enough context to form a meaningful standalone chunk.
const CODE_BOUNDARY_RE = /^(?:export\s+(?:default\s+)?|async\s+)?(?:function\s+\w|class\s+\w|const\s+\w[^=]*=\s*(?:async\s*)?\(|interface\s+\w|type\s+\w|enum\s+\w|def\s+\w|async\s+def\s+\w|func\s+\w|fn\s+\w|public\s+(?:static\s+)?(?:class|void|int|String)|impl\s+\w)/m;

function splitCodeByBoundaries(text: string): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = Math.ceil(line.length / 4); // rough approximation

    // Start a new chunk at a boundary if current chunk is non-trivial
    if (
      current.length > 0 &&
      currentTokens > WORD_CHUNK_SIZE / 2 &&
      CODE_BOUNDARY_RE.test(line)
    ) {
      const chunk = current.join("\n").trim();
      if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
      current = [];
      currentTokens = 0;
    }

    current.push(line);
    currentTokens += lineTokens;

    // Force-flush if chunk is too large
    if (currentTokens > WORD_CHUNK_SIZE * 2) {
      const chunk = current.join("\n").trim();
      if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
      current = [];
      currentTokens = 0;
    }
  }

  if (current.length > 0) {
    const chunk = current.join("\n").trim();
    if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
  }

  // Fallback: if no boundaries found, use word-based splitting
  return chunks.length > 0 ? chunks : splitByWords(text);
}

// ── Log event splitter ────────────────────────────────────────────────────────

// Matches common log line prefixes: timestamps, severity levels
const LOG_BOUNDARY_RE = /^(?:\d{4}[-/]\d{2}[-/]\d{2}|\[\d{4}|\w{3}\s+\d{1,2}\s+\d{2}:\d{2}|(?:ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\s*[:\s])/m;

function splitLogByEvents(text: string): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (current.length > 0 && LOG_BOUNDARY_RE.test(line)) {
      const chunk = current.join("\n").trim();
      if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
      current = [];
    }
    current.push(line);
    // Force-flush every 50 log lines to keep chunks bounded
    if (current.length >= 50) {
      const chunk = current.join("\n").trim();
      if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
      current = [];
    }
  }

  if (current.length > 0) {
    const chunk = current.join("\n").trim();
    if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
  }

  return chunks.length > 0 ? chunks : splitByWords(text);
}

// ── Word-based overlapping splitter (default) ─────────────────────────────────

function splitByWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const wordsPerChunk = Math.floor(WORD_CHUNK_SIZE * WORDS_PER_TOKEN);
  const overlapWords = Math.floor(WORD_OVERLAP * WORDS_PER_TOKEN);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk) chunks.push(chunk.slice(0, MAX_CHUNK_CHARS));
    start += wordsPerChunk - overlapWords;
    if (start >= words.length) break;
  }

  return chunks;
}

// ── File kind detection ───────────────────────────────────────────────────────

type ChunkKind = "code" | "log" | "text";

const CODE_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "go", "rs", "java", "kt", "swift",
  "c", "cpp", "h", "cs", "rb", "php",
  "sql", "sh", "bash",
]);

const LOG_EXTS = new Set(["log", "logs"]);

function detectChunkKind(fileName: string, text: string): ChunkKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (CODE_EXTS.has(ext)) return "code";
  if (LOG_EXTS.has(ext)) return "log";
  // Heuristic: if text looks like logs (many timestamp-prefixed lines), treat as log
  const lines = text.split("\n").slice(0, 20);
  const logLikeLines = lines.filter((l) => LOG_BOUNDARY_RE.test(l)).length;
  if (logLikeLines >= 3) return "log";
  return "text";
}

// ── Public splitting function ─────────────────────────────────────────────────

export function splitIntoChunks(
  text: string,
  fileName = "",
): string[] {
  if (!text.trim()) return [];
  const kind = detectChunkKind(fileName, text);
  switch (kind) {
    case "code": return splitCodeByBoundaries(text);
    case "log": return splitLogByEvents(text);
    default: return splitByWords(text);
  }
}

// ── Embedding generation ──────────────────────────────────────────────────────

interface EmbeddingResponse {
  data: Array<{ index: number; embedding: number[] }>;
}

async function generateEmbeddings(texts: string[]): Promise<Array<number[] | null>> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);

  // Batch into groups to respect API limits
  const results: Array<number[] | null> = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBED_MODEL,
          input: batch,
          dimensions: EMBED_DIMENSIONS,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.error(JSON.stringify({
          level: "error",
          event: "EMBED_API_FAILED",
          status: res.status,
          batchStart: i,
        }));
        continue; // Leave this batch as null — tsvector fallback will cover it
      }

      const data = await res.json() as EmbeddingResponse;
      for (const item of data.data) {
        results[i + item.index] = item.embedding;
      }
    } catch (err) {
      console.error(JSON.stringify({
        level: "error",
        event: "EMBED_EXCEPTION",
        batchStart: i,
        reason: err instanceof Error ? err.message : String(err),
      }));
      // Continue — remaining batches may still succeed
    }
  }

  return results;
}

// ── Main indexing function ────────────────────────────────────────────────────

export async function chunkAndIndexFile(
  fileId: string,
  text: string,
  fileName = "",
): Promise<{ chunkCount: number; embeddedCount: number }> {
  const admin = createAdminClient();
  const chunks = splitIntoChunks(text, fileName);
  if (chunks.length === 0) return { chunkCount: 0, embeddedCount: 0 };

  // Delete existing chunks for this file (re-index)
  await admin.from("file_chunks").delete().eq("file_id", fileId);

  const rows = chunks.map((content, index) => ({
    file_id: fileId,
    chunk_index: index,
    content,
    token_count: Math.ceil(content.split(/\s+/).filter(Boolean).length / WORDS_PER_TOKEN),
  }));

  // Insert chunks in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await admin
      .from("file_chunks")
      .insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`Chunk insert failed at batch ${i}: ${error.message}`);
  }

  // Generate embeddings and write back
  // Failure here is non-fatal — tsvector search still works
  let embeddedCount = 0;
  try {
    const embeddings = await generateEmbeddings(chunks);

    const embeddingUpdates = embeddings
      .map((embedding, index) =>
        embedding ? { file_id: fileId, chunk_index: index, embedding } : null,
      )
      .filter((u): u is { file_id: string; chunk_index: number; embedding: number[] } => u !== null);

    if (embeddingUpdates.length > 0) {
      // Write embeddings back by (file_id, chunk_index)
      for (const update of embeddingUpdates) {
        const { error } = await admin
          .from("file_chunks")
          .update({ embedding: JSON.stringify(update.embedding) })
          .eq("file_id", update.file_id)
          .eq("chunk_index", update.chunk_index);
        if (!error) embeddedCount++;
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      event: "CHUNK_EMBED_FAILED",
      fileId,
      reason: err instanceof Error ? err.message : String(err),
    }));
  }

  console.log(JSON.stringify({
    level: "info",
    event: "FILE_INDEXED",
    fileId,
    fileName,
    chunkCount: chunks.length,
    embeddedCount,
  }));

  return { chunkCount: chunks.length, embeddedCount };
}
