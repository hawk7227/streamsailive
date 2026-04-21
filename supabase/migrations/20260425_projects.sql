-- Migration: projects
--
-- Adds project grouping for conversations within a workspace.
-- A project is a named collection of conversations sharing a common goal.
--
-- projects            — one row per project
-- project_conversations — join table: (project_id, conversation_id)
--
-- conversation_id is stored as TEXT (not UUID FK) because conversations
-- are tracked client-side via localStorage — no server-side conversations table.

-- ── projects ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace
  ON projects(workspace_id, created_at DESC);

COMMENT ON TABLE projects IS
  'Named groupings of conversations within a workspace. '
  'Each project has optional context (description) injected into the system prompt.';

-- ── project_conversations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_conversations (
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT        NOT NULL,
  workspace_id    UUID        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_project_conversations_conversation
  ON project_conversations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_project_conversations_workspace
  ON project_conversations(workspace_id, project_id);

COMMENT ON TABLE project_conversations IS
  'Join table: which conversations belong to which project. '
  'conversation_id is a client-side UUID string (no FK to conversations table).';

COMMENT ON COLUMN project_conversations.conversation_id IS
  'Client-side conversation UUID persisted in localStorage. '
  'Stored as TEXT — no server-side conversations table exists.';
