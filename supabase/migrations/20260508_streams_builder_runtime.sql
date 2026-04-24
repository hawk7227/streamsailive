-- ============================================================
-- Migration: streams_builder_runtime (corrected)
-- Phase 6 of STREAMS System Upgrade — Builder Runtime Upgrade
--
-- The Phase 6 runtime is primarily code (src/lib/streams/runtime.ts
-- and src/lib/streams/runtime-action.ts) rather than schema.
-- This migration adds the runtime_sessions table that tracks
-- every executeAction() call for audit and proof purposes.
--
-- Tables:
--   runtime_sessions — one row per executeAction() invocation
--
-- RLS: service role only. No workspace_members dependency.
-- ============================================================

-- ── runtime_sessions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS runtime_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL,
  project_id      UUID,
  session_id      TEXT        NOT NULL,

  -- Action identity
  action_type     TEXT        NOT NULL,   -- matches EXECUTORS key in runtime-action.ts
  actor           TEXT        NOT NULL DEFAULT 'system',

  -- Context snapshot at time of action
  had_project_context   BOOLEAN NOT NULL DEFAULT false,
  had_memory_loaded     BOOLEAN NOT NULL DEFAULT false,
  had_active_tasks      INTEGER NOT NULL DEFAULT 0,
  context_hash          TEXT,   -- from project_startup_context

  -- Execution
  status          TEXT        NOT NULL DEFAULT 'completed',
  -- status: 'completed' | 'failed' | 'blocked'
  error           TEXT,
  duration_ms     INTEGER,

  -- Output
  artifact_id     UUID,       -- if action produced an artifact
  task_id         UUID,       -- task that was advanced (if any)
  proof_status    TEXT,       -- proof classification of the output

  -- Write-back
  wrote_decision  BOOLEAN NOT NULL DEFAULT false,
  wrote_issue     BOOLEAN NOT NULL DEFAULT false,
  wrote_handoff   BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Immutable — never updated
);

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_workspace
  ON runtime_sessions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_project
  ON runtime_sessions(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_action
  ON runtime_sessions(action_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_failed
  ON runtime_sessions(workspace_id, created_at DESC)
  WHERE status = 'failed';

ALTER TABLE runtime_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE runtime_sessions IS
  'One row per executeAction() invocation. Tracks every governed build action. '
  'Records whether project context, memory, and tasks were loaded. '
  'Used to prove that the runtime enforces the 6-step contract.';

-- ── Proof records ─────────────────────────────────────────────────────────────

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
      'Phase6/BuilderRuntime',
      'Builder Runtime Upgrade complete: resolveProject(), assembleContext(), classifyAction(), writeActionResult(), executeAction() — single runtime path enforced',
      'ImplementedButUnproven',
      'source',
      'Migration 20260508_streams_builder_runtime.sql applied. runtime_sessions table created. Runtime code in src/lib/streams/runtime.ts (383 lines) and src/lib/streams/runtime-action.ts (342 lines). POST /api/streams/runtime is the single governed endpoint. Status ImplementedButUnproven until first action runs through the full 6-step contract and writes a runtime_session row.',
      'system'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
