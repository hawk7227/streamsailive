-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: streams_connector_layer
-- Phase 7 of STREAMS System Upgrade — Connector Action Layer
--
-- Tables:
--   connected_accounts    — provider credentials, encrypted at rest
--   connector_action_logs — every action taken via a connector
--
-- Requirements from spec:
--   - Encrypted at rest
--   - Never exposed to chat
--   - Project-scoped usage
--   - Revocable and rotatable
--   - Sessionless reuse
--   - Runtime auto-resolution
--   - Destructive action governance
-- ─────────────────────────────────────────────────────────────────────────────

-- ── connector_provider enum ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE connector_provider AS ENUM (
    'github',
    'vercel',
    'supabase'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── connector_status enum ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE connector_status AS ENUM (
    'active',       -- connected and last validation passed
    'invalid',      -- credentials exist but validation failed
    'revoked',      -- manually revoked by user
    'expired'       -- token expired, needs rotation
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── connected_accounts ────────────────────────────────────────────────────────
-- One row per provider per workspace.
-- encrypted_credentials is AES-256 encrypted before insert.
-- The raw credential value is NEVER returned to the client.

CREATE TABLE IF NOT EXISTS connected_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- provider identity
  provider              connector_provider NOT NULL,
  provider_account_id   text,
  -- e.g. GitHub username, Vercel team slug, Supabase project ref

  -- scopes granted
  scopes                text[] NOT NULL DEFAULT '{}',
  -- e.g. ['repo', 'read:org'] for GitHub

  -- encrypted credentials — AES-256-GCM, never returned raw
  -- format: base64(iv):base64(ciphertext):base64(authTag)
  encrypted_credentials text NOT NULL,

  -- status
  status                connector_status NOT NULL DEFAULT 'active',

  -- project binding — null means workspace-level (all projects)
  project_id            uuid REFERENCES projects(id) ON DELETE SET NULL,

  -- validation
  last_validated_at     timestamptz,
  validation_error      text,
  -- populated when status = 'invalid' or 'expired'

  -- rotation
  rotated_at            timestamptz,
  rotation_due_at       timestamptz,
  -- credentials should be rotated before this date

  -- audit
  connected_by          uuid REFERENCES auth.users(id),
  connected_at          timestamptz NOT NULL DEFAULT now(),
  revoked_by            uuid REFERENCES auth.users(id),
  revoked_at            timestamptz,

  -- one active connection per provider per workspace
  UNIQUE (workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS connected_accounts_workspace_idx
  ON connected_accounts(workspace_id, provider, status);

CREATE INDEX IF NOT EXISTS connected_accounts_user_idx
  ON connected_accounts(user_id, provider);

CREATE INDEX IF NOT EXISTS connected_accounts_rotation_idx
  ON connected_accounts(rotation_due_at)
  WHERE status = 'active' AND rotation_due_at IS NOT NULL;

-- ── connector_action_logs ─────────────────────────────────────────────────────
-- Immutable log of every action taken via a connector.
-- Destructive actions (push, deploy, delete) are always logged.
-- Provides full audit trail for governance.

CREATE TABLE IF NOT EXISTS connector_action_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  session_id      text,

  provider        connector_provider NOT NULL,

  -- what was done
  action_name     text NOT NULL,
  -- e.g. 'git_push', 'vercel_deploy', 'supabase_query'

  -- is this a destructive action?
  is_destructive  boolean NOT NULL DEFAULT false,

  -- what was the target
  target          text,
  -- e.g. 'hawk7227/streamsailive:main', 'project-id', 'public.artifacts'

  -- outcome
  success         boolean NOT NULL,
  response_status integer,
  error_message   text,

  -- proof linkage
  proof_record_id uuid,

  -- timing
  initiated_by    uuid REFERENCES auth.users(id),
  initiated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS connector_action_logs_workspace_idx
  ON connector_action_logs(workspace_id, initiated_at DESC);

CREATE INDEX IF NOT EXISTS connector_action_logs_account_idx
  ON connector_action_logs(account_id, initiated_at DESC);

CREATE INDEX IF NOT EXISTS connector_action_logs_destructive_idx
  ON connector_action_logs(workspace_id, is_destructive, initiated_at DESC)
  WHERE is_destructive = true;

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE connected_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_action_logs  ENABLE ROW LEVEL SECURITY;

-- Members can see their workspace's connected accounts (but never raw credentials)
CREATE POLICY "workspace_members_connected_accounts" ON connected_accounts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_connector_logs" ON connector_action_logs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
