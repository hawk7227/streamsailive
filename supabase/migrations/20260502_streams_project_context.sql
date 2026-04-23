-- ============================================================
-- Migration: streams_project_context
-- Phase 2 of STREAMS System Upgrade — Project Context Container
--
-- Extends the thin projects table into a full project OS:
--
--   project_settings       — rules, standards, active phase, assistant config
--   project_rules          — per-project custom rules that override workspace defaults
--   project_bindings       — GitHub / Vercel / Supabase / storage linkage
--   project_sessions       — server-side session records (extends localStorage model)
--   project_startup_context — snapshot of context loaded at session start
--
-- The existing `projects` table (20260425) is extended with new columns.
-- The existing `project_conversations` table is left unchanged.
-- ============================================================

-- ── Extend projects table ─────────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS owner_user_id  UUID,
  ADD COLUMN IF NOT EXISTS status         TEXT    NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('active','archived','paused')),
  ADD COLUMN IF NOT EXISTS active_phase   TEXT,          -- e.g. 'Phase2/ProjectContext'
  ADD COLUMN IF NOT EXISTS context_prompt TEXT,          -- injected into every session system prompt
  ADD COLUMN IF NOT EXISTS rules_ref      TEXT,          -- path to project-specific rules doc
  ADD COLUMN IF NOT EXISTS metadata       JSONB   NOT NULL DEFAULT '{}';

COMMENT ON COLUMN projects.context_prompt IS
  'Injected verbatim at the start of every session system prompt for this project. '
  'Loaded by project_startup_context_loader at session start.';

COMMENT ON COLUMN projects.active_phase IS
  'Current build phase for this project, e.g. Phase2/ProjectContext. '
  'Loaded into context so the assistant knows where the project stands.';

-- ── project_settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_settings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                UUID        NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id              UUID        NOT NULL,

  -- Build standards
  build_rules_version       TEXT        NOT NULL DEFAULT 'v1', -- which BUILD_RULES.md version governs this project
  enforce_audit_layer       BOOLEAN     NOT NULL DEFAULT true,
  require_proof_before_done BOOLEAN     NOT NULL DEFAULT true,
  block_merge_on_critical   BOOLEAN     NOT NULL DEFAULT true,

  -- Assistant config
  default_model             TEXT        NOT NULL DEFAULT 'gpt-4o',
  mini_model                TEXT        NOT NULL DEFAULT 'gpt-4o-mini',
  max_context_tokens        INTEGER     NOT NULL DEFAULT 8000,
  temperature               NUMERIC(3,2) NOT NULL DEFAULT 0.2,

  -- Session config
  auto_load_memory          BOOLEAN     NOT NULL DEFAULT true,
  auto_write_memory         BOOLEAN     NOT NULL DEFAULT true,
  session_summary_after_n   INTEGER     NOT NULL DEFAULT 5, -- summarise after N turns

  -- Workspace-level overrides
  custom_system_prompt      TEXT,
  pinned_facts              JSONB       NOT NULL DEFAULT '[]', -- array of {key, value} facts always loaded

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_settings_project
  ON project_settings(project_id);

COMMENT ON TABLE project_settings IS
  'Per-project configuration: build standards, assistant config, session config. '
  'One row per project. Created automatically when a project is created.';

-- ── project_rules ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_rules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL,

  rule_ref      TEXT        NOT NULL,  -- e.g. 'Rule 1.1' or 'CUSTOM.1'
  rule_source   TEXT        NOT NULL DEFAULT 'project', -- 'BUILD_RULES' | 'FRONTEND_BUILD_RULES' | 'project'
  rule_text     TEXT        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'high'
                            CHECK (severity IN ('critical','high','medium','low')),
  is_override   BOOLEAN     NOT NULL DEFAULT false, -- true = overrides a global rule
  is_active     BOOLEAN     NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, rule_ref)
);

CREATE INDEX IF NOT EXISTS idx_project_rules_project
  ON project_rules(project_id, is_active);

COMMENT ON TABLE project_rules IS
  'Project-specific rules that extend or override global BUILD_RULES. '
  'Loaded at session start and injected into the system prompt context.';

-- ── project_bindings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_bindings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID        NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id        UUID        NOT NULL,

  -- GitHub
  github_repo         TEXT,       -- e.g. 'hawk7227/streamsailive'
  github_branch       TEXT,       -- e.g. 'main'
  github_account_id   UUID,       -- FK to connected_accounts (Phase 7)

  -- Vercel
  vercel_project_id   TEXT,       -- e.g. 'prj_xxxxxxxxxxxx'
  vercel_project_name TEXT,
  vercel_team_id      TEXT,
  vercel_account_id   UUID,       -- FK to connected_accounts (Phase 7)

  -- Supabase
  supabase_project_ref TEXT,      -- e.g. 'xyzxyzxyzxyz'
  supabase_project_url TEXT,
  supabase_account_id  UUID,      -- FK to connected_accounts (Phase 7)

  -- Storage
  storage_bucket      TEXT,       -- default output bucket for generated assets
  storage_prefix      TEXT,       -- path prefix within bucket

  -- Environment
  environment         TEXT        NOT NULL DEFAULT 'production'
                      CHECK (environment IN ('development','staging','production')),
  env_vars_hint       JSONB       NOT NULL DEFAULT '{}', -- { KEY: 'last4chars' } masked display only

  -- Status
  last_verified_at    TIMESTAMPTZ,
  verification_status TEXT        NOT NULL DEFAULT 'unverified'
                      CHECK (verification_status IN ('verified','unverified','failed')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_bindings_project
  ON project_bindings(project_id);

COMMENT ON TABLE project_bindings IS
  'GitHub / Vercel / Supabase / storage bindings for a project. '
  'Auto-resolved at runtime so actions use the correct repo/branch/project '
  'without requiring the user to specify them each time. '
  'Credential references point to connected_accounts (Phase 7) — '
  'never store raw credentials here.';

-- ── project_sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id      UUID        NOT NULL,
  user_id           UUID,

  -- Session identity
  conversation_id   TEXT        NOT NULL UNIQUE, -- matches localStorage conversationId
  title             TEXT,
  mode              TEXT        NOT NULL DEFAULT 'chat'
                    CHECK (mode IN ('chat','build','generate','review')),

  -- Context snapshot at session start
  context_loaded_at TIMESTAMPTZ,
  context_version   TEXT,       -- hash of the context snapshot for cache invalidation

  -- Turn tracking
  turn_count        INTEGER     NOT NULL DEFAULT 0,
  last_turn_at      TIMESTAMPTZ,

  -- Memory
  memory_written    BOOLEAN     NOT NULL DEFAULT false,
  summary_written   BOOLEAN     NOT NULL DEFAULT false,

  -- Status
  status            TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','abandoned')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_sessions_project
  ON project_sessions(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_sessions_conversation
  ON project_sessions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_project_sessions_active
  ON project_sessions(project_id, status, last_turn_at DESC)
  WHERE status = 'active';

COMMENT ON TABLE project_sessions IS
  'Server-side session records bridging localStorage conversationId to a project. '
  'One row per conversation. Created when a session is assigned to a project. '
  'Tracks turn count, memory write state, and context version.';

-- ── project_startup_context ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_startup_context (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id      UUID        REFERENCES project_sessions(id) ON DELETE SET NULL,
  workspace_id    UUID        NOT NULL,

  -- The assembled context
  system_prompt   TEXT        NOT NULL, -- full assembled system prompt for this project+session
  project_name    TEXT        NOT NULL,
  active_phase    TEXT,
  bindings_summary JSONB      NOT NULL DEFAULT '{}', -- { github_repo, branch, vercel_project, ... }
  active_rules    JSONB       NOT NULL DEFAULT '[]', -- array of active project_rules
  pinned_facts    JSONB       NOT NULL DEFAULT '[]', -- from project_settings.pinned_facts
  context_hash    TEXT        NOT NULL, -- SHA256 of the assembled context for cache hits

  -- Validity
  loaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  is_stale        BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_startup_context_project
  ON project_startup_context(project_id, loaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_startup_context_valid
  ON project_startup_context(project_id, is_stale, valid_until)
  WHERE is_stale = false;

COMMENT ON TABLE project_startup_context IS
  'Cached startup context assembled for each project+session at session start. '
  'Invalidated (is_stale=true) when project settings, bindings, or rules change. '
  'The system_prompt column is the assembled text injected into the first model call.';

-- ── Triggers: auto-create project_settings and project_bindings on new project ─

CREATE OR REPLACE FUNCTION create_project_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-create project_settings
  INSERT INTO project_settings (project_id, workspace_id)
  VALUES (NEW.id, NEW.workspace_id)
  ON CONFLICT (project_id) DO NOTHING;

  -- Auto-create project_bindings (empty)
  INSERT INTO project_bindings (project_id, workspace_id)
  VALUES (NEW.id, NEW.workspace_id)
  ON CONFLICT (project_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_defaults ON projects;
CREATE TRIGGER trg_project_defaults
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION create_project_defaults();

-- ── Trigger: invalidate startup context when bindings/settings/rules change ───

CREATE OR REPLACE FUNCTION invalidate_project_context()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_startup_context
    SET is_stale = true
  WHERE project_id = NEW.project_id
    AND is_stale = false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invalidate_on_settings ON project_settings;
CREATE TRIGGER trg_invalidate_on_settings
  AFTER UPDATE ON project_settings
  FOR EACH ROW EXECUTE FUNCTION invalidate_project_context();

DROP TRIGGER IF EXISTS trg_invalidate_on_bindings ON project_bindings;
CREATE TRIGGER trg_invalidate_on_bindings
  AFTER UPDATE ON project_bindings
  FOR EACH ROW EXECUTE FUNCTION invalidate_project_context();

DROP TRIGGER IF EXISTS trg_invalidate_on_rules ON project_rules;
CREATE TRIGGER trg_invalidate_on_rules
  AFTER INSERT OR UPDATE OR DELETE ON project_rules
  FOR EACH ROW EXECUTE FUNCTION invalidate_project_context();

-- ── Seed: Phase 2 proof record ────────────────────────────────────────────────

INSERT INTO proof_records (
  subject_type, subject_ref, claim, status, proof_type, proof_detail, proved_by
) VALUES (
  'phase',
  'Phase2/ProjectContextContainer',
  'Project Context Container schema exists: project_settings, project_rules, project_bindings, project_sessions, project_startup_context tables with auto-create triggers and invalidation triggers',
  'Proven',
  'source',
  'Migration 20260502_streams_project_context.sql applied. 5 new tables. projects extended with owner_user_id, status, active_phase, context_prompt, rules_ref, metadata. Auto-create trigger on projects INSERT. Invalidation triggers on settings/bindings/rules UPDATE.',
  'system'
) ON CONFLICT DO NOTHING;
