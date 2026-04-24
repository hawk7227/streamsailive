-- ============================================================
-- Migration: streams_memory_system
-- Phase 3 of STREAMS System Upgrade — Memory System
--
-- Provides persistent project memory across sessions.
-- Purpose: continuity comes from the system, not chat history.
--
-- 6 tables:
--   project_memory_rules  — persistent rules governing how a project is built
--   decision_log          — every meaningful decision made per project
--   issue_history         — what went wrong and what fixed it
--   session_summaries     — end-of-session state for next session to load
--   latest_handoffs       — one row per project, most recent handoff document
--   pinned_project_facts  — key=value facts always loaded at session start
--
-- Note: workspace_id columns are plain UUID (no FK to workspaces table)
-- to avoid dependency on tables that may not exist in all environments.
-- RLS uses service role (admin client) only — no auth.uid() policies.
-- ============================================================

-- ── 1. project_memory_rules ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_memory_rules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL,
  project_id    UUID,
  rule_text     TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'general',
  -- category: 'code' | 'design' | 'process' | 'general'
  priority      INTEGER     NOT NULL DEFAULT 0,
  -- higher = loaded first. top 20 by priority loaded per session
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_rules_workspace
  ON project_memory_rules(workspace_id, is_active, priority DESC);

CREATE INDEX IF NOT EXISTS idx_memory_rules_project
  ON project_memory_rules(project_id, is_active, priority DESC)
  WHERE project_id IS NOT NULL;

COMMENT ON TABLE project_memory_rules IS
  'Persistent rules governing how a project is built. '
  'Written by the operator. Top 20 by priority loaded at every session start.';

-- ── 2. decision_log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL,
  project_id      UUID,
  session_id      TEXT,
  decision_text   TEXT        NOT NULL,
  rationale       TEXT,
  -- outcome: 'pending' | 'proven' | 'reverted' | 'superseded'
  outcome         TEXT        NOT NULL DEFAULT 'pending',
  proof_record_id UUID,
  made_by         UUID,
  made_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_log_project
  ON decision_log(project_id, made_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_log_workspace
  ON decision_log(workspace_id, made_at DESC);

COMMENT ON TABLE decision_log IS
  'Every meaningful architectural and build decision per project. '
  'Last 10 decisions are loaded at session start. '
  'outcome=proven means the decision was verified with a proof record.';

-- ── 3. issue_history ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issue_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL,
  project_id     UUID,
  session_id     TEXT,
  issue_summary  TEXT        NOT NULL,
  issue_detail   TEXT,
  resolution     TEXT,
  -- status: 'open' | 'resolved' | 'wont_fix'
  status         TEXT        NOT NULL DEFAULT 'open',
  -- category: 'build' | 'design' | 'runtime' | 'data' | 'auth' | 'other'
  category       TEXT        NOT NULL DEFAULT 'build',
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_issue_history_project_open
  ON issue_history(project_id, occurred_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_issue_history_workspace
  ON issue_history(workspace_id, status, occurred_at DESC);

COMMENT ON TABLE issue_history IS
  'Record of what went wrong per project and what fixed it. '
  'Open issues loaded at session start to prevent repeating mistakes.';

-- ── 4. session_summaries ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_summaries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL,
  project_id     UUID,
  session_id     TEXT        NOT NULL,
  summary_text   TEXT        NOT NULL,
  completed      TEXT[]      NOT NULL DEFAULT '{}',
  in_progress    TEXT[]      NOT NULL DEFAULT '{}',
  next_steps     TEXT[]      NOT NULL DEFAULT '{}',
  files_touched  TEXT[]      NOT NULL DEFAULT '{}',
  last_commit    TEXT,
  vercel_green   BOOLEAN,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_project
  ON session_summaries(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_summaries_workspace
  ON session_summaries(workspace_id, created_at DESC);

COMMENT ON TABLE session_summaries IS
  'End-of-session summaries. One row per session. '
  'The most recent summary is loaded at the next session start '
  'to restore context without reading chat history.';

-- ── 5. latest_handoffs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS latest_handoffs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID        NOT NULL,
  project_id         UUID        NOT NULL UNIQUE,
  handoff_text       TEXT        NOT NULL,
  last_commit        TEXT,
  last_vercel_status TEXT,
  violation_count    INTEGER     NOT NULL DEFAULT 0,
  pending_items      TEXT[]      NOT NULL DEFAULT '{}',
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by       UUID
);

CREATE INDEX IF NOT EXISTS idx_latest_handoffs_workspace
  ON latest_handoffs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_latest_handoffs_project
  ON latest_handoffs(project_id);

COMMENT ON TABLE latest_handoffs IS
  'One row per project — the single most recent handoff document. '
  'Upserted at session end (ON CONFLICT project_id). '
  'Loaded at session start. Contains everything needed to resume '
  'work without reading chat history.';

-- ── 6. pinned_project_facts ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pinned_project_facts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL,
  project_id    UUID        NOT NULL,
  fact_key      TEXT        NOT NULL,
  fact_value    TEXT        NOT NULL,
  is_sensitive  BOOLEAN     NOT NULL DEFAULT false,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, fact_key)
);

CREATE INDEX IF NOT EXISTS idx_pinned_facts_project
  ON pinned_project_facts(project_id);

COMMENT ON TABLE pinned_project_facts IS
  'Short key=value facts pinned to a project. '
  'ALL pinned facts loaded at every session start (no truncation). '
  'Sensitive facts shown masked in UI. '
  'Examples: github_repo, branch, vercel_project_id, tech_stack.';

-- ── RLS — service role only ───────────────────────────────────────────────────
-- All reads/writes go through the admin client (service role key).
-- No browser client accesses these tables directly.

ALTER TABLE project_memory_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE latest_handoffs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_project_facts  ENABLE ROW LEVEL SECURITY;

-- ── Seed: bootstrap memory for STREAMS project ────────────────────────────────
-- Inserts the core BUILD_RULES as memory rules for any workspace that
-- wants to load them. These are the rules that govern STREAMS development.

-- Note: workspace_id is left as a placeholder UUID — update to your real
-- workspace ID after running this migration.

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
      'Phase3/MemorySystem',
      'Memory System schema exists: project_memory_rules, decision_log, issue_history, session_summaries, latest_handoffs, pinned_project_facts — 6 tables with indexes and RLS',
      'ImplementedButUnproven',
      'source',
      'Migration 20260505_streams_memory_system.sql applied. 6 tables created. Runtime: loadProjectMemory(), writeSessionHandoff(), logDecision(), logIssue(), resolveIssue(), formatMemoryForContext() in src/lib/streams/memory.ts. Status ImplementedButUnproven until first real memory load+write cycle is verified.',
      'system'
    ) ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Phase 3 proof record inserted.';
  ELSE
    RAISE NOTICE 'proof_records table not found — run Phase 1 migration first.';
  END IF;
END $$;
