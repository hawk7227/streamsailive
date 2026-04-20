-- Migration: video_scene_tracking
-- Adds parent_id and scene_index to generations for long-video scene lineage tracking.
-- Run this before deploying the long-video scene-batch runtime.

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS parent_id   UUID REFERENCES generations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scene_index INTEGER;

-- Index for fast sibling lookup when checking scene completion
CREATE INDEX IF NOT EXISTS idx_generations_parent_id ON generations(parent_id)
  WHERE parent_id IS NOT NULL;

-- Comment on intent
COMMENT ON COLUMN generations.parent_id   IS 'For long-video: UUID of the parent generation record that owns this scene clip';
COMMENT ON COLUMN generations.scene_index IS 'For long-video: zero-based index of this scene clip within the parent job';
