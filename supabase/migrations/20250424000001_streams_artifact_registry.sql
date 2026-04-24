-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: streams_artifact_registry
-- Phase 4 of STREAMS System Upgrade — Artifact Registry
--
-- Tables:
--   artifacts         — canonical artifact identity per project
--   artifact_versions — immutable version records
--
-- Purpose: outputs become persistent build objects, not transient chat emissions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── artifact_type enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM (
    'code',
    'doc',
    'image',
    'video',
    'svg',
    'react',
    'html',
    'schema',
    'prompt_pack'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── artifact_state enum ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artifact_state AS ENUM (
    'draft',        -- being worked on, not stable
    'stable',       -- current working version
    'deprecated',   -- superseded by a newer artifact
    'archived'      -- no longer active, kept for reference
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── artifact_proof_state enum ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artifact_proof_state AS ENUM (
    'Unproven',              -- created but not verified
    'ImplementedButUnproven',-- built but not tested/deployed
    'Proven',                -- verified working (Vercel green, tests pass, etc.)
    'Rejected'               -- found to be broken or wrong
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── artifacts ─────────────────────────────────────────────────────────────────
-- One row per unique artifact. Canonical identity.
-- current_version_id points to the latest artifact_versions row.

CREATE TABLE IF NOT EXISTS artifacts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id           uuid REFERENCES projects(id) ON DELETE CASCADE,

  -- identity
  name                 text NOT NULL,
  slug                 text NOT NULL,
  -- slug: url-safe identifier, unique within project. e.g. "streams-panel", "tokens-ts"
  description          text,

  -- type
  artifact_type        artifact_type NOT NULL,

  -- state
  state                artifact_state NOT NULL DEFAULT 'draft',
  proof_state          artifact_proof_state NOT NULL DEFAULT 'Unproven',

  -- current version pointer (nullable until first version is created)
  current_version_id   uuid,

  -- origin
  -- 'generated' = produced by AI/pipeline
  -- 'edited'    = manually written or modified
  -- 'imported'  = brought in from outside
  origin               text NOT NULL DEFAULT 'generated'
                       CHECK (origin IN ('generated', 'edited', 'imported')),

  -- preview
  -- URL to render a preview of this artifact (image URL, deployed URL, etc.)
  preview_url          text,

  -- links to other system objects
  generation_log_id    uuid,  -- FK to generation_log if produced by a generation
  session_id           text,  -- session that created it
  task_id              uuid,  -- FK to tasks (Phase 5) if created for a task

  -- metadata
  tags                 text[] NOT NULL DEFAULT '{}',
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- slug unique within project
  UNIQUE (project_id, slug)
);

-- Add FK from artifacts.current_version_id → artifact_versions after that table exists
-- (done below with ALTER TABLE)

CREATE INDEX IF NOT EXISTS artifacts_workspace_idx
  ON artifacts(workspace_id, state, updated_at DESC);

CREATE INDEX IF NOT EXISTS artifacts_project_idx
  ON artifacts(project_id, artifact_type, state, updated_at DESC);

CREATE INDEX IF NOT EXISTS artifacts_generation_log_idx
  ON artifacts(generation_log_id) WHERE generation_log_id IS NOT NULL;

-- ── artifact_versions ─────────────────────────────────────────────────────────
-- Immutable version records. One row per save/commit of an artifact.
-- Content is stored inline for code/doc/schema types.
-- For image/video types, content_url holds the asset URL.

CREATE TABLE IF NOT EXISTS artifact_versions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id          uuid NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- version identity
  version_number       integer NOT NULL,
  -- auto-incremented per artifact, set by application layer

  -- content
  -- inline content for text-based artifacts (code, doc, html, react, svg, schema)
  content_text         text,
  -- URL for binary artifacts (image, video) or large text stored externally
  content_url          text,
  -- MIME type of the content
  content_type         text,
  -- byte size of content_text or referenced asset
  content_size_bytes   bigint,

  -- change description
  change_summary       text,
  -- what changed in this version vs the previous

  -- proof state for this specific version
  proof_state          artifact_proof_state NOT NULL DEFAULT 'Unproven',
  -- proof evidence: commit hash, Vercel URL, test output, etc.
  proof_evidence       text,

  -- origin of this version
  origin               text NOT NULL DEFAULT 'generated'
                       CHECK (origin IN ('generated', 'edited', 'imported')),

  -- preview URL for this specific version
  preview_url          text,

  -- links
  session_id           text,
  generation_log_id    uuid,
  task_id              uuid,

  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- version number unique per artifact
  UNIQUE (artifact_id, version_number)
);

CREATE INDEX IF NOT EXISTS artifact_versions_artifact_idx
  ON artifact_versions(artifact_id, version_number DESC);

CREATE INDEX IF NOT EXISTS artifact_versions_workspace_idx
  ON artifact_versions(workspace_id, proof_state, created_at DESC);

-- ── FK: artifacts.current_version_id → artifact_versions ─────────────────────

ALTER TABLE artifacts
  ADD CONSTRAINT artifacts_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES artifact_versions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE artifacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_artifacts" ON artifacts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_artifact_versions" ON artifact_versions
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
