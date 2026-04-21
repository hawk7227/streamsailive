-- Migration: video_jobs_and_artifacts
-- Adds video_jobs and artifacts tables for the video-runtime layer.
-- video_jobs: one row per provider job or clip (replaces parent_id hack on generations)
-- artifacts:  one row per durable stored output asset
-- Run this before deploying video-runtime/generateVideo.ts

-- Add conversation_id to generations if missing (needed for conversation linkage)
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- video_jobs: tracks every provider job submission and its lifecycle
CREATE TABLE IF NOT EXISTS video_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id    UUID        NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  parent_job_id    UUID        REFERENCES video_jobs(id) ON DELETE SET NULL,
  workspace_id     UUID        NOT NULL,
  provider         TEXT        NOT NULL,
  model            TEXT,
  provider_job_id  TEXT,        -- provider's own tracking ID (fal response_url, kling task_id, etc.)
  clip_index       INTEGER,     -- null for single-clip; 0-based index for longform clips
  phase            TEXT        NOT NULL DEFAULT 'submit', -- 'submit' | 'poll' | 'finalize'
  status           TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  request_payload  JSONB       NOT NULL DEFAULT '{}',
  response_payload JSONB,
  output_url       TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_generation_id
  ON video_jobs(generation_id);

CREATE INDEX IF NOT EXISTS idx_video_jobs_pending
  ON video_jobs(status, created_at)
  WHERE status IN ('pending', 'queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_video_jobs_parent_job_id
  ON video_jobs(parent_job_id)
  WHERE parent_job_id IS NOT NULL;

-- artifacts: one row per durable stored output
CREATE TABLE IF NOT EXISTS artifacts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id    UUID        NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  workspace_id     UUID        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'video', -- 'video' | 'image' | 'audio'
  storage_url      TEXT        NOT NULL,
  mime_type        TEXT        NOT NULL DEFAULT 'video/mp4',
  duration_seconds NUMERIC,
  width            INTEGER,
  height           INTEGER,
  thumbnail_url    TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_generation_id
  ON artifacts(generation_id);

COMMENT ON TABLE video_jobs IS 'One row per provider job or clip. Replaces parent_id hack on generations table.';
COMMENT ON TABLE artifacts  IS 'One row per durable stored output asset. Never stores temporary provider URLs.';
COMMENT ON COLUMN video_jobs.provider_job_id IS 'Provider-specific job ID. For fal: response_url. For kling/runway: task_id.';
COMMENT ON COLUMN video_jobs.clip_index      IS 'null for single-clip jobs; 0-based index for longform scene clips.';

-- generation_jobs: unified job table for song and voice runtimes.
-- (video uses video_jobs for now; future slice consolidates all into generation_jobs)
CREATE TABLE IF NOT EXISTS generation_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id    UUID        NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  workspace_id     UUID        NOT NULL,
  media_type       TEXT        NOT NULL,   -- 'song' | 'voice'
  provider         TEXT        NOT NULL,
  model            TEXT,
  provider_job_id  TEXT,
  phase            TEXT        NOT NULL DEFAULT 'submit',
  status           TEXT        NOT NULL DEFAULT 'pending',
  request_payload  JSONB       NOT NULL DEFAULT '{}',
  response_payload JSONB,
  output_url       TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_generation_id ON generation_jobs(generation_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_pending
  ON generation_jobs(status, media_type, created_at)
  WHERE status IN ('pending', 'queued', 'processing');

COMMENT ON TABLE generation_jobs IS 'Unified job table for song and voice runtimes. Video uses video_jobs (future: consolidate).';
