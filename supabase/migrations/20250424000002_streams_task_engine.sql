-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: streams_task_engine
-- Phase 5 of STREAMS System Upgrade — Task + Assignment Engine
--
-- Tables:
--   tasks            — structured work items with status, priority, owner
--   task_history     — immutable timeline of every status/assignment change
--   task_artifacts   — task-to-artifact links
--   task_proof_links — task-to-proof_records links
--
-- Purpose: ongoing builder work becomes structured and queryable.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── task_status enum ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'backlog',     -- not yet started, no commitment
    'todo',        -- committed, not started
    'in_progress', -- actively being worked
    'blocked',     -- cannot proceed, reason recorded
    'in_review',   -- work done, awaiting approval
    'approved',    -- approved, ready to close
    'done',        -- completed and verified
    'cancelled'    -- will not be done
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── task_priority enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM (
    'critical',  -- blocks everything else
    'high',
    'medium',
    'low',
    'none'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── task_owner_type enum ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_owner_type AS ENUM (
    'user',   -- assigned to a specific user
    'ai',     -- assigned to the AI builder
    'system'  -- automated / system-driven
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── task_approval_state enum ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_approval_state AS ENUM (
    'not_required', -- task does not need approval
    'pending',      -- awaiting approval
    'approved',     -- approved by designated reviewer
    'rejected'      -- rejected, requires rework
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── tasks ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,

  -- identity
  title             text NOT NULL,
  description       text,

  -- status + priority
  status            task_status NOT NULL DEFAULT 'backlog',
  priority          task_priority NOT NULL DEFAULT 'medium',

  -- owner
  owner_type        task_owner_type NOT NULL DEFAULT 'ai',
  owner_user_id     uuid REFERENCES auth.users(id),
  -- owner_user_id only set when owner_type = 'user'

  -- approval
  approval_state    task_approval_state NOT NULL DEFAULT 'not_required',
  approved_by       uuid REFERENCES auth.users(id),
  approved_at       timestamptz,
  rejection_reason  text,

  -- blocking
  blocked_reason    text,
  -- populated when status = 'blocked'

  -- next step
  next_step         text,
  -- the single concrete action that must happen next

  -- dependencies — array of task IDs this task depends on
  -- must all be 'done' before this task can move to 'in_progress'
  depends_on        uuid[] NOT NULL DEFAULT '{}',

  -- recurrence
  is_recurring      boolean NOT NULL DEFAULT false,
  recurrence_rule   text,
  -- rrule string e.g. 'FREQ=WEEKLY;BYDAY=MO'
  next_due_at       timestamptz,

  -- timing
  due_at            timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,

  -- proof
  -- FK to proof_records (Phase 1 table) when task is proven
  proof_record_id   uuid,

  -- session that created the task
  session_id        text,

  -- tags
  tags              text[] NOT NULL DEFAULT '{}',

  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_workspace_status_idx
  ON tasks(workspace_id, status, priority DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS tasks_project_idx
  ON tasks(project_id, status, priority DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS tasks_owner_idx
  ON tasks(owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_due_idx
  ON tasks(next_due_at) WHERE is_recurring = true AND next_due_at IS NOT NULL;

-- ── task_history ──────────────────────────────────────────────────────────────
-- Immutable timeline. One row per meaningful change.
-- Captures what changed, who changed it, and when.

CREATE TABLE IF NOT EXISTS task_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- what event occurred
  event_type    text NOT NULL,
  -- 'created' | 'status_changed' | 'assigned' | 'priority_changed' |
  -- 'blocked' | 'unblocked' | 'approved' | 'rejected' |
  -- 'dependency_added' | 'dependency_removed' | 'note_added' | 'completed'

  -- before/after for changed fields
  from_value    text,
  to_value      text,

  -- free-form note for this history entry
  note          text,

  -- who triggered this event
  actor_type    task_owner_type NOT NULL DEFAULT 'user',
  actor_user_id uuid REFERENCES auth.users(id),

  session_id    text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_history_task_idx
  ON task_history(task_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS task_history_workspace_idx
  ON task_history(workspace_id, occurred_at DESC);

-- ── task_artifacts ────────────────────────────────────────────────────────────
-- Links tasks to artifacts produced or consumed by them.

CREATE TABLE IF NOT EXISTS task_artifacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  artifact_id  uuid NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- role of the artifact in this task
  role         text NOT NULL DEFAULT 'output',
  -- 'output'  — artifact was produced by this task
  -- 'input'   — artifact was consumed/used by this task
  -- 'context' — artifact provided context for this task

  linked_at    timestamptz NOT NULL DEFAULT now(),
  linked_by    uuid REFERENCES auth.users(id),

  UNIQUE (task_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS task_artifacts_task_idx
  ON task_artifacts(task_id);

CREATE INDEX IF NOT EXISTS task_artifacts_artifact_idx
  ON task_artifacts(artifact_id);

-- ── task_proof_links ──────────────────────────────────────────────────────────
-- Links tasks to proof_records (Phase 1).
-- Allows a task to accumulate multiple proof records over its lifetime.

CREATE TABLE IF NOT EXISTS task_proof_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  proof_record_id uuid NOT NULL REFERENCES proof_records(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  linked_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (task_id, proof_record_id)
);

CREATE INDEX IF NOT EXISTS task_proof_links_task_idx
  ON task_proof_links(task_id);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_artifacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_proof_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_tasks" ON tasks
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_task_history" ON task_history
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_task_artifacts" ON task_artifacts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_task_proof_links" ON task_proof_links
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
