-- Migration: vector_embeddings_and_artifact_linkage
--
-- 1. Enable pgvector extension
-- 2. Add embedding column to file_chunks for semantic search
-- 3. Create IVFFlat index for ANN search
-- 4. Create semantic search RPC function
-- 5. Add conversation_id to artifacts for conversation ↔ output linkage
--
-- Run this before deploying the updated chunker and retrieval layer.

-- ── 1. Enable pgvector ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Embedding column on file_chunks ────────────────────────────────────────
-- text-embedding-3-small produces 1536-dimensional vectors.
-- NULL means the chunk was indexed before embeddings were enabled, or
-- embedding generation failed — tsvector fallback is used in that case.
ALTER TABLE file_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ── 3. IVFFlat index for approximate nearest-neighbor search ─────────────────
-- lists = 100 is appropriate for datasets up to ~1M vectors.
-- Only indexes rows where embedding IS NOT NULL.
CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding
  ON file_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- ── 4. Semantic similarity search RPC ────────────────────────────────────────
-- Called by the retrieval layer as a Supabase RPC.
-- Returns chunks ordered by cosine similarity to the query embedding.
-- Falls back gracefully if embedding IS NULL (those rows are skipped).
CREATE OR REPLACE FUNCTION search_file_chunks_semantic(
  query_embedding vector(1536),
  file_ids        uuid[],
  max_results     int DEFAULT 10
)
RETURNS TABLE (
  file_id     uuid,
  chunk_index int,
  content     text,
  similarity  float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.file_id,
    fc.chunk_index,
    fc.content,
    1.0 - (fc.embedding <=> query_embedding) AS similarity
  FROM file_chunks fc
  WHERE fc.file_id = ANY(file_ids)
    AND fc.embedding IS NOT NULL
  ORDER BY fc.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- ── 5. Conversation linkage on artifacts ──────────────────────────────────────
-- Connects generated outputs (video, audio, image) back to the conversation
-- that produced them, enabling the assistant to reference its own prior work.
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

CREATE INDEX IF NOT EXISTS idx_artifacts_conversation_id
  ON artifacts(conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN artifacts.conversation_id IS 'Conversation that triggered this artifact. Enables assistant to list and reuse prior generated outputs.';
COMMENT ON COLUMN file_chunks.embedding IS 'OpenAI text-embedding-3-small (1536-dim). NULL = not yet embedded; tsvector fallback used.';
