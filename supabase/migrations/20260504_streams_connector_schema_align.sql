-- ============================================================
-- Migration: streams_connector_schema_align
-- Corrects the Phase 7 schema to match src/lib/connector/ code.
--
-- The 20260503 migration used different column names than
-- the existing connector library. This migration fixes the
-- gap so the DB matches what the code actually queries.
--
-- Changes:
--   connected_accounts     — add missing columns, encrypted_credentials TEXT
--   connector_action_logs  — rename columns to match code
--   connector_permission_grants — create table (code uses this, not connector_permissions)
-- ============================================================

-- ── connected_accounts — align with connector/repository.ts ──────────────────

-- Add encrypted_credentials as TEXT (base64-encoded AES-GCM output)
-- The code uses a single string field, not two BYTEA columns
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT;

-- Add columns the code inserts that the migration missed
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS provider_account_url  TEXT,
  ADD COLUMN IF NOT EXISTS display_name          TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS validation_error      TEXT,
  ADD COLUMN IF NOT EXISTS rotated_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rotation_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT now();

-- The SAFE_FIELDS constant in repository.ts selects these exact fields —
-- all must exist. The old BYTEA columns stay but are unused by code.

-- ── connector_action_logs — rename to match repository.ts insert ──────────────

-- Code inserts: operation, input_summary, outcome, output_summary, was_gated, approval_gate_id
-- Migration had: (none of operation/input_summary/outcome/output_summary/was_gated)

ALTER TABLE connector_action_logs
  ADD COLUMN IF NOT EXISTS operation          TEXT,
  ADD COLUMN IF NOT EXISTS input_summary      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS output_summary     JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outcome            TEXT,   -- 'success' | 'failure' | 'blocked'
  ADD COLUMN IF NOT EXISTS was_gated          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_outcome       TEXT,
  ADD COLUMN IF NOT EXISTS approval_gate_id   UUID;

-- Add index on outcome for failure queries
CREATE INDEX IF NOT EXISTS idx_connector_action_logs_outcome
  ON connector_action_logs(workspace_id, outcome, created_at DESC)
  WHERE outcome = 'failure';

-- ── connector_permission_grants — what the code actually uses ─────────────────
-- repository.ts queries: connector_permission_grants (not connector_permissions)

CREATE TABLE IF NOT EXISTS connector_permission_grants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID        NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  project_id        UUID        NOT NULL,
  workspace_id      UUID        NOT NULL,

  granted_scopes    TEXT[]      NOT NULL DEFAULT '{}',
  allow_destructive BOOLEAN     NOT NULL DEFAULT false,

  granted_by        TEXT,       -- user_id
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,

  UNIQUE (account_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_connector_grants_account
  ON connector_permission_grants(account_id, project_id);

CREATE INDEX IF NOT EXISTS idx_connector_grants_project
  ON connector_permission_grants(project_id)
  WHERE revoked_at IS NULL;

ALTER TABLE connector_permission_grants ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE connector_permission_grants IS
  'Per-project permission grants for connected accounts. '
  'Controls which projects can use each connected account, and whether '
  'destructive operations (push, deploy, migrate) are allowed.';

-- ── Update proof record to ImplementedButUnproven ─────────────────────────────
-- Phase 7 schema is now aligned with the code. Not yet Proven until a real
-- OAuth connection is made and round-tripped through the runtime.

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
      'Phase7/ConnectorSchemaAlign',
      'connector_action_logs, connected_accounts, and connector_permission_grants schema aligned with src/lib/connector/ code',
      'Proven',
      'source',
      'Migration 20260504_streams_connector_schema_align.sql applied. All column names in repository.ts now match DB schema. encrypted_credentials TEXT added. connector_permission_grants table created.',
      'system'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
