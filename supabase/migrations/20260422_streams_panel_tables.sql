-- ── Streams Panel Tables ─────────────────────────────────────────────────────
-- Standalone panel owns its own tables.
-- No FK to generations — panel does not couple to the existing generation layer.
-- Run after 20260421_video_jobs_and_artifacts.sql

-- generation_log: one row per generation submitted from the streams panel
CREATE TABLE IF NOT EXISTS generation_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL,
  generation_type TEXT        NOT NULL,  -- video_t2v | video_i2v | image | voice | music | motion
  model           TEXT        NOT NULL,
  fal_endpoint    TEXT        NOT NULL,
  input_params    JSONB       NOT NULL DEFAULT '{}',
  fal_request_id  TEXT,                  -- fal responseUrl / queue handle
  fal_status      TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (fal_status IN ('pending','processing','done','failed')),
  output_url      TEXT,                  -- durable Supabase storage URL (never fal temp URL)
  fal_error       TEXT,
  fal_duration_ms INTEGER,
  cost_usd        NUMERIC(10,6),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_log_workspace   ON generation_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_log_status      ON generation_log(fal_status) WHERE fal_status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS idx_generation_log_request_id  ON generation_log(fal_request_id) WHERE fal_request_id IS NOT NULL;

ALTER TABLE generation_log ENABLE ROW LEVEL SECURITY;
-- workspace_id check requires join — use service role in API routes (admin client)

-- workspace_settings: per-workspace API keys and model defaults
CREATE TABLE IF NOT EXISTS workspace_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID        NOT NULL UNIQUE,
  fal_key_hint            TEXT,         -- last 4 chars of FAL key (masked display)
  elevenlabs_key_hint     TEXT,
  openai_key_hint         TEXT,
  default_video_model     TEXT        NOT NULL DEFAULT 'kling-v3-standard',
  default_image_model     TEXT        NOT NULL DEFAULT 'flux-kontext',
  default_voice_model     TEXT        NOT NULL DEFAULT 'eleven-v3',
  default_music_model     TEXT        NOT NULL DEFAULT 'minimax-v2.6',
  cost_limit_daily_usd    NUMERIC(10,2),
  cost_limit_monthly_usd  NUMERIC(10,2),
  quality_preset          TEXT        NOT NULL DEFAULT 'standard'
                          CHECK (quality_preset IN ('fast','standard','pro')),
  watermark_enabled       BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace ON workspace_settings(workspace_id);

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

-- person_analysis: ingest pipeline output per person per video
CREATE TABLE IF NOT EXISTS person_analysis (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL,
  generation_log_id    UUID        REFERENCES generation_log(id) ON DELETE CASCADE,
  person_index         INTEGER     NOT NULL DEFAULT 0,
  face_reference_url   TEXT,
  voice_id             TEXT,         -- ElevenLabs IVC voice_id
  appearance_description TEXT,       -- GPT-4o Vision auto-generated character description
  speaking_segments    JSONB       NOT NULL DEFAULT '[]',
  transcript           JSONB       NOT NULL DEFAULT '[]',  -- word-level timestamps from Scribe v2
  frame_scores         JSONB       NOT NULL DEFAULT '[]',  -- per-frame quality from GPT-4o Vision
  face_quality         TEXT        CHECK (face_quality IN ('frontal','angled','obscured')),
  body_visibility      TEXT        CHECK (body_visibility IN ('head_only','torso','full_body')),
  expression_baseline  TEXT        CHECK (expression_baseline IN ('neutral','happy','intense')),
  ingest_status        TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (ingest_status IN ('pending','processing','done','failed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_analysis_workspace     ON person_analysis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_person_analysis_generation_log ON person_analysis(generation_log_id);

ALTER TABLE person_analysis ENABLE ROW LEVEL SECURITY;

-- reference_analyses: GPT-4o Vision analysis results
CREATE TABLE IF NOT EXISTS reference_analyses (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        NOT NULL,
  source_type           TEXT        NOT NULL CHECK (source_type IN ('upload','url','youtube')),
  source_url            TEXT,
  color_palette         JSONB       NOT NULL DEFAULT '[]',
  lighting              TEXT,
  composition           TEXT,
  camera_details        TEXT,
  style_tags            JSONB       NOT NULL DEFAULT '[]',
  subjects              JSONB       NOT NULL DEFAULT '[]',
  motion_summary        TEXT,
  transcript            JSONB       NOT NULL DEFAULT '[]',
  reconstruction_prompt TEXT,
  variation_prompts     JSONB       NOT NULL DEFAULT '[]',
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','done','failed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_analyses_workspace ON reference_analyses(workspace_id);

ALTER TABLE reference_analyses ENABLE ROW LEVEL SECURITY;

-- video_versions: edit chain with rollback support
CREATE TABLE IF NOT EXISTS video_versions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        NOT NULL,
  generation_log_id     UUID        REFERENCES generation_log(id),
  parent_version_id     UUID        REFERENCES video_versions(id),
  edit_type             TEXT        CHECK (edit_type IN ('voice_word','full_body','motion_style','language_dub','emotion')),
  edit_metadata         JSONB       NOT NULL DEFAULT '{}',
  output_url            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_versions_generation_log ON video_versions(generation_log_id);

ALTER TABLE video_versions ENABLE ROW LEVEL SECURITY;

-- bulk_jobs: parallel/multi-prompt generation tracking
CREATE TABLE IF NOT EXISTS bulk_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL,
  name             TEXT,
  mode             TEXT        NOT NULL CHECK (mode IN ('parallel','multi_prompt','sequential')),
  total_count      INTEGER     NOT NULL DEFAULT 0,
  completed_count  INTEGER     NOT NULL DEFAULT 0,
  failed_count     INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','completed','partial','failed')),
  result_urls      JSONB       NOT NULL DEFAULT '[]',
  cost_usd         NUMERIC(10,4),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_workspace ON bulk_jobs(workspace_id, created_at DESC);

ALTER TABLE bulk_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bulk_job_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_job_id   UUID        NOT NULL REFERENCES bulk_jobs(id) ON DELETE CASCADE,
  item_index    INTEGER     NOT NULL,
  prompt        TEXT,
  fal_request_id TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed')),
  output_url    TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_job_items_job ON bulk_job_items(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_job_items_fal ON bulk_job_items(fal_request_id) WHERE fal_request_id IS NOT NULL;

ALTER TABLE bulk_job_items ENABLE ROW LEVEL SECURITY;

-- share_links: slug-based sharing
CREATE TABLE IF NOT EXISTS share_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,
  generation_log_id UUID      REFERENCES generation_log(id),
  title           TEXT,
  is_public       BOOLEAN     NOT NULL DEFAULT true,
  password_hash   TEXT,
  expires_at      TIMESTAMPTZ,
  view_count      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_links_slug      ON share_links(slug);
CREATE INDEX IF NOT EXISTS idx_share_links_workspace ON share_links(workspace_id);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- ── analyst_sessions ────────────────────────────────────────────────────────
-- Stores prompt analyst results for audit trail and cost tracking.
-- Non-blocking insert — analyst route continues if this fails.
CREATE TABLE IF NOT EXISTS public.analyst_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  mode                  TEXT NOT NULL,
  input_prompt          TEXT NOT NULL,
  analysis              JSONB,
  model_recommendation  TEXT,
  cost_before_usd       NUMERIC(10,4),
  cost_after_usd        NUMERIC(10,4),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analyst_sessions_workspace_idx ON public.analyst_sessions(workspace_id);
ALTER TABLE public.analyst_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON public.analyst_sessions
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));
