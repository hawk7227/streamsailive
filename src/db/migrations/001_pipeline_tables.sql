-- ============================================================
-- MIGRATION 001 — StreamsAI Pipeline Tables
-- Run this in Supabase SQL Editor (Project: dggunmqrbimlsuaohkpx)
-- Run in order. Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- 1. workspace_niches
-- Stores per-workspace governance configurations (built-in + custom)
CREATE TABLE IF NOT EXISTS workspace_niches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              text NOT NULL,
  pipeline_type     text NOT NULL DEFAULT 'custom',
  brand_tone        text,
  approved_facts    jsonb NOT NULL DEFAULT '[]',
  banned_phrases    jsonb NOT NULL DEFAULT '[]',
  strategy_prompt   text,
  copy_prompt       text,
  validator_prompt  text,
  image_prompt      text,
  image_to_video    text,
  qa_instruction    text,
  ruleset_version   text NOT NULL DEFAULT 'custom-v1',
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_niches_workspace_id_idx ON workspace_niches(workspace_id);

-- 2. pipeline_sessions
-- Saves full pipeline state per run (prompts, step states, outputs)
CREATE TABLE IF NOT EXISTS pipeline_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  niche_id            text NOT NULL DEFAULT 'telehealth',
  selected_concept_id text,
  prompts             jsonb NOT NULL DEFAULT '{}',
  step_states         jsonb NOT NULL DEFAULT '{}',
  outputs             jsonb NOT NULL DEFAULT '{"script":null,"image":null,"video":null}',
  pipeline_status     text NOT NULL DEFAULT 'idle'
                      CHECK (pipeline_status IN ('idle','running','paused','complete','error')),
  current_step_id     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_sessions_workspace_id_idx ON pipeline_sessions(workspace_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pipeline_sessions_updated_at ON pipeline_sessions;
CREATE TRIGGER update_pipeline_sessions_updated_at
  BEFORE UPDATE ON pipeline_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workspace_niches_updated_at ON workspace_niches;
CREATE TRIGGER update_workspace_niches_updated_at
  BEFORE UPDATE ON workspace_niches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Extend generations table
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS provider     text,
  ADD COLUMN IF NOT EXISTS concept_id   text,
  ADD COLUMN IF NOT EXISTS session_id   uuid REFERENCES pipeline_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mode         text NOT NULL DEFAULT 'standard'
                                        CHECK (mode IN ('standard','pro')),
  ADD COLUMN IF NOT EXISTS cost_estimate numeric(10,4) DEFAULT 0;

-- 4. Enable Realtime on generations (required for UPDATE events to push to browser)
ALTER TABLE generations REPLICA IDENTITY FULL;

-- 5. RLS policies
ALTER TABLE workspace_niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_sessions ENABLE ROW LEVEL SECURITY;

-- workspace_niches: workspace members can read; workspace admins can write
DROP POLICY IF EXISTS workspace_niches_select ON workspace_niches;
CREATE POLICY workspace_niches_select ON workspace_niches
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspace_niches_insert ON workspace_niches;
CREATE POLICY workspace_niches_insert ON workspace_niches
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspace_niches_update ON workspace_niches;
CREATE POLICY workspace_niches_update ON workspace_niches
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspace_niches_delete ON workspace_niches;
CREATE POLICY workspace_niches_delete ON workspace_niches
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- pipeline_sessions: same pattern
DROP POLICY IF EXISTS pipeline_sessions_select ON pipeline_sessions;
CREATE POLICY pipeline_sessions_select ON pipeline_sessions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pipeline_sessions_insert ON pipeline_sessions;
CREATE POLICY pipeline_sessions_insert ON pipeline_sessions
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pipeline_sessions_update ON pipeline_sessions;
CREATE POLICY pipeline_sessions_update ON pipeline_sessions
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFY (run these SELECTs after migration to confirm)
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'generations' AND column_name IN ('provider','concept_id','session_id','mode','cost_estimate');
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('workspace_niches','pipeline_sessions');
