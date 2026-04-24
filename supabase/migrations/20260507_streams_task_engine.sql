-- ============================================================
-- Migration: streams_task_engine (corrected)
-- Phase 5 of STREAMS System Upgrade — Task + Assignment Engine
--
-- Tables:
--   tasks            — structured work items with status, priority, owner
--   task_history     — immutable timeline of every status/assignment change
--   task_artifacts   — task-to-artifact links
--   task_proof_links — task-to-proof_records links
--
-- Purpose: ongoing builder work becomes structured and queryable.
-- RLS: service role only (admin client). No workspace_members dependency.
-- ============================================================

-- ── task_status enum ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'backlog',     -- not yet started
    'todo',        -- committed, not started
    'in_progress', -- actively being worked
    'blocked',     -- cannot proceed, reason recorded
    'in_review',   -- done, awaiting approval
    'approved',    -- approved, ready to close
    'done',        -- completed and verified
    'cancelled'    -- will not be done
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── task_priority enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM (
    'critical',   -- blocks everything else
    'high',       -- do next
    'medium',     -- do this sprint
    'low'         -- someday / nice to have
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── tasks ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID          NOT NULL,
  project_id      UUID,
  session_id      TEXT,

  -- Identity
  title           TEXT          NOT NULL,
  description     TEXT,
  task_status     task_status   NOT NULL DEFAULT 'todo',
  priority        task_priority NOT NULL DEFAULT 'medium',

  -- Assignment
  assigned_to     TEXT,         -- 'user:{id}' | 'ai' | 'system'
  assigned_by     UUID,

  -- Approval
  requires_approval BOOLEAN     NOT NULL DEFAULT false,
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,

  -- Dependencies
  depends_on      UUID[],       -- array of task IDs this task depends on

  -- Context
  blocked_reason  TEXT,         -- why blocked (if status = 'blocked')
  open_next_step  TEXT,         -- what to do next (for in_progress tasks)

  -- Scheduling
  due_at          TIMESTAMPTZ,
  recurrence      TEXT,         -- 'daily' | 'weekly' | cron expr | null

  -- Proof linkage
  proof_record_id UUID,

  -- Authorship
  created_by      UUID          NOT NULL,
  updated_by      UUID,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_active
  ON tasks(workspace_id, task_status, priority DESC, created_at DESC)
  WHERE task_status NOT IN ('done', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_tasks_project
  ON tasks(project_id, task_status, updated_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned
  ON tasks(assigned_to, task_status)
  WHERE task_status NOT IN ('done', 'cancelled');

COMMENT ON TABLE tasks IS
  'Structured work items. Every meaningful piece of work gets a task. '
  'assigned_to can be a user ID, "ai", or "system". '
  'depends_on contains task IDs that must be done first. '
  'Purpose: ongoing builder work becomes structured and queryable.';

-- ── task_history ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_history (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id    UUID          NOT NULL,

  -- What changed
  field_changed   TEXT          NOT NULL,  -- 'status' | 'assigned_to' | 'priority' | 'blocked_reason'
  old_value       TEXT,
  new_value       TEXT,
  change_note     TEXT,

  -- Who changed it
  changed_by      TEXT          NOT NULL DEFAULT 'system', -- 'user:{id}' | 'ai' | 'system'

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
  -- Immutable — never updated
);

CREATE INDEX IF NOT EXISTS idx_task_history_task
  ON task_history(task_id, created_at DESC);

COMMENT ON TABLE task_history IS
  'Immutable timeline of every change to a task. '
  'One row per field change. Never updated, never deleted.';

-- ── task_artifacts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_artifacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  artifact_id UUID        NOT NULL,   -- references artifacts(id) — no FK to allow phase ordering
  workspace_id UUID       NOT NULL,
  link_type   TEXT        NOT NULL DEFAULT 'output',
  -- link_type: 'output' (task produced this) | 'input' (task consumed this) | 'reference'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_task_artifacts_task
  ON task_artifacts(task_id);

CREATE INDEX IF NOT EXISTS idx_task_artifacts_artifact
  ON task_artifacts(artifact_id);

-- ── task_proof_links ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_proof_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  proof_record_id UUID        NOT NULL,  -- references proof_records(id)
  workspace_id    UUID        NOT NULL,
  link_type       TEXT        NOT NULL DEFAULT 'proves',
  -- link_type: 'proves' | 'blocks' | 'related'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, proof_record_id)
);

CREATE INDEX IF NOT EXISTS idx_task_proof_links_task
  ON task_proof_links(task_id);

-- ── RLS — service role only ───────────────────────────────────────────────────

ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_artifacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_proof_links ENABLE ROW LEVEL SECURITY;

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
      'Phase5/TaskEngine',
      'Task Engine schema exists: tasks, task_history, task_artifacts, task_proof_links with enums, indexes, and RLS',
      'ImplementedButUnproven',
      'source',
      'Migration 20260507_streams_task_engine.sql applied. 4 tables, 2 enums. Runtime in src/lib/streams/tasks.ts. API routes at /api/streams/tasks. Status ImplementedButUnproven until first task is created and advances through a status transition.',
      'system'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
