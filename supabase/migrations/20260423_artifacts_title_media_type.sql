-- Migration: artifacts_title_media_type
--
-- Adds two columns to the artifacts table:
--   title      TEXT  — human-readable label, truncated prompt (for browse panel)
--   media_type TEXT  — fine-grained type within the coarse 'type' category
--
-- The existing 'type' column retains its coarse values:
--   'image' | 'video' | 'audio'
--
-- The new 'media_type' column carries precise values:
--   'image' | 'video' | 'i2v' | 'song' | 'song_stem' | 'voice'
--
-- Rationale for two columns:
--   'type'       — used by existing queries (no breaking change)
--   'media_type' — used by new browse panel and inline artifact renderer
--
-- Both columns are nullable — all existing rows retain NULL values.
-- New writes populate both.

-- ── title ─────────────────────────────────────────────────────────────────────
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN artifacts.title IS
  'Human-readable label for the browse panel. Truncated generation prompt (≤200 chars). NULL on legacy rows.';

-- ── media_type ────────────────────────────────────────────────────────────────
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS media_type TEXT;

COMMENT ON COLUMN artifacts.media_type IS
  'Fine-grained artifact type: image | video | i2v | song | song_stem | voice. NULL on legacy rows.';

-- ── Index: browse panel filter by media_type within a workspace ───────────────
CREATE INDEX IF NOT EXISTS idx_artifacts_media_type
  ON artifacts(workspace_id, media_type)
  WHERE media_type IS NOT NULL;

-- ── Index: browse panel query by workspace + conversation ─────────────────────
-- conversation_id index was added in 20260422, but only scoped to conversation_id.
-- This compound index covers the browse panel's primary query pattern:
--   WHERE workspace_id = ? AND conversation_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_artifacts_workspace_conversation_created
  ON artifacts(workspace_id, conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;
