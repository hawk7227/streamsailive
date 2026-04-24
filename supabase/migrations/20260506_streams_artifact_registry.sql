-- ============================================================
-- Migration: streams_artifact_registry (corrected)
-- Phase 4 of STREAMS System Upgrade — Artifact Registry
--
-- Tables:
--   artifacts         — canonical artifact identity per project
--   artifact_versions — immutable version records (one per save/edit)
--
-- Purpose: outputs become persistent build objects, not transient chat emissions.
-- RLS: service role only (admin client). No workspace_members dependency.
-- ============================================================

-- ── artifact_type enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM (
    'code', 'doc', 'image', 'video', 'svg',
    'react', 'html', 'schema', 'prompt_pack'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── artifact_state enum ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artifact_state AS ENUM (
    'draft',      -- being created, not yet usable
    'stable',     -- current working version
    'archived',   -- older, replaced by a newer artifact
    'deleted'     -- soft-deleted
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── artifact_origin enum ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artifact_origin AS ENUM (
    'generated',  -- produced by AI model
    'edited',     -- human-edited from a generated artifact
    'imported'    -- uploaded or brought in from outside
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── artifacts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS artifacts (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID            NOT NULL,
  project_id      UUID,
  session_id      TEXT,

  -- Identity
  name            TEXT            NOT NULL,
  slug            TEXT            NOT NULL,
  description     TEXT,
  artifact_type   artifact_type   NOT NULL,
  origin          artifact_origin NOT NULL DEFAULT 'generated',
  tags            TEXT[]          NOT NULL DEFAULT '{}',

  -- State
  state           artifact_state  NOT NULL DEFAULT 'stable',
  current_version INTEGER         NOT NULL DEFAULT 1,

  -- Content (latest version cache — full content in artifact_versions)
  content_url     TEXT,   -- storage URL for binary content (image, video)
  content_text    TEXT,   -- inline text content (code, doc, html)
  content_type    TEXT,   -- MIME type
  preview_url     TEXT,   -- thumbnail / preview image URL

  -- Proof
  proof_status    TEXT    NOT NULL DEFAULT 'ImplementedButUnproven',
  -- proof_status mirrors proof_records.status enum

  -- Linkage
  task_id         UUID,
  generation_log_id UUID,

  -- Authorship
  created_by      UUID    NOT NULL,
  updated_by      UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_workspace
  ON artifacts(workspace_id, state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_artifacts_project
  ON artifacts(project_id, state, updated_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artifacts_type
  ON artifacts(artifact_type, workspace_id, state);

CREATE INDEX IF NOT EXISTS idx_artifacts_task
  ON artifacts(task_id)
  WHERE task_id IS NOT NULL;

COMMENT ON TABLE artifacts IS
  'Canonical artifact identity. One row per distinct output object. '
  'Versions are stored in artifact_versions. current_version tracks which '
  'version is live. state=stable is the active version. '
  'Purpose: outputs become persistent build objects, not transient chat emissions.';

-- ── artifact_versions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS artifact_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id     UUID        NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL,
  project_id      UUID,
  session_id      TEXT,

  -- Version identity
  version_number  INTEGER     NOT NULL,
  change_summary  TEXT,       -- what changed in this version

  -- Content snapshot (immutable per version)
  content_url     TEXT,
  content_text    TEXT,
  content_type    TEXT,
  preview_url     TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',

  -- Proof state at time of version creation
  proof_status    TEXT        NOT NULL DEFAULT 'ImplementedButUnproven',

  -- Authorship
  created_by      UUID        NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (artifact_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact
  ON artifact_versions(artifact_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_workspace
  ON artifact_versions(workspace_id, created_at DESC);

COMMENT ON TABLE artifact_versions IS
  'Immutable version snapshots. One row per save/edit of an artifact. '
  'Rows are never updated — each edit creates a new version. '
  'The current live version is artifacts.current_version.';

-- ── RLS — service role only ───────────────────────────────────────────────────

ALTER TABLE artifacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

-- ── Proof record ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proof_records'
  ) THEN
    INSERT INTO proof_records (
      subject_type, subject_ref, claim, status, proof_type, proof_detail, proved_by
    ) VALUES (
      'phase',
      'Phase4/ArtifactRegistry',
      'Artifact Registry schema exists: artifacts + artifact_versions tables with enums, indexes, and RLS',
      'ImplementedButUnproven',
      'source',
      'Migration 20260506_streams_artifact_registry.sql applied. 2 tables, 3 enums. Runtime in src/lib/streams/artifacts.ts. API routes at /api/streams/artifacts. Status ImplementedButUnproven until first artifact is created and versioned via the registry.',
      'system'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
