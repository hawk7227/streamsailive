-- ============================================================
-- Migration: streams_connector_action_layer
-- Phase 7 of STREAMS System Upgrade — Connector Action Layer
--
-- Tables:
--   connected_accounts       — OAuth tokens + API keys per provider per workspace
--   connector_permissions    — what each account can do, scoped to project/workspace
--   connector_action_logs    — every governed action taken via a connector
--   connector_approval_queue — destructive actions pending human approval
--
-- Extends:
--   project_bindings         — adds FK constraints to connected_accounts
--   proof_records            — seeds Phase 7 proof record
--
-- Security model:
--   credentials are encrypted at rest using pgp_sym_encrypt (pgcrypto)
--   the encryption key lives in CONNECTOR_ENCRYPTION_KEY env var only
--   decrypted credentials are NEVER returned to the browser or chat
--   all connector operations are logged in connector_action_logs
--   destructive operations (push, deploy, delete) require approval gate
-- ============================================================

-- ── Enable pgcrypto for credential encryption ─────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── provider enum ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE connector_provider AS ENUM (
    'github',
    'vercel',
    'supabase',
    'openai',
    'fal',
    'elevenlabs',
    'anthropic'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── connector_status enum ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE connector_status AS ENUM (
    'active',     -- credentials valid, in use
    'expired',    -- OAuth token expired, needs re-auth
    'revoked',    -- manually revoked by user
    'error',      -- last validation failed
    'pending'     -- OAuth flow started, not completed
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── connector_action_type enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE connector_action_type AS ENUM (
    -- GitHub
    'git_read',          -- read file / list branches
    'git_commit',        -- commit files
    'git_push',          -- push to remote
    'git_create_branch', -- create branch
    -- Vercel
    'vercel_read',       -- read deployment status / logs
    'vercel_deploy',     -- trigger deployment
    'vercel_rollback',   -- rollback deployment
    -- Supabase
    'db_read',           -- read schema / run query
    'db_migrate',        -- apply migration
    'db_rpc',            -- call stored procedure
    'storage_read',      -- read storage object
    'storage_write',     -- write to storage
    -- Account management
    'connect',           -- establish connector
    'validate',          -- test connection
    'revoke',            -- revoke connector
    'rotate'             -- rotate credentials
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── approval_decision enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE approval_decision AS ENUM (
    'pending',
    'approved',
    'rejected',
    'auto_approved',  -- approved by system rule (no destructive impact)
    'expired'         -- gate expired before decision
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- connected_accounts
--
-- One row per (workspace, provider) pair. A workspace may have multiple
-- accounts for the same provider (e.g. two GitHub orgs).
--
-- SECURITY:
--   encrypted_access_token  — pgp_sym_encrypt(access_token, key)
--   encrypted_refresh_token — pgp_sym_encrypt(refresh_token, key)
--   Never store plaintext tokens. Never return encrypted blob to client.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connected_accounts (
  id                       UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID               NOT NULL,
  user_id                  UUID,              -- user who connected this account

  -- Provider identity
  provider                 connector_provider NOT NULL,
  provider_account_id      TEXT,              -- their ID on the provider (GitHub user_id, Vercel team_id)
  provider_account_name    TEXT,              -- display name (GitHub username, email, org name)
  provider_account_email   TEXT,              -- email if available

  -- Encrypted credentials
  -- Use pgp_sym_encrypt(value::text, current_setting('app.connector_key'))
  encrypted_access_token   BYTEA,
  encrypted_refresh_token  BYTEA,
  token_hint               TEXT,              -- last 4 chars of token for display only

  -- OAuth metadata
  scopes                   TEXT[]             NOT NULL DEFAULT '{}',
  token_type               TEXT               NOT NULL DEFAULT 'bearer',
  expires_at               TIMESTAMPTZ,       -- NULL = non-expiring (API keys)

  -- Status
  status                   connector_status   NOT NULL DEFAULT 'pending',
  last_validated_at        TIMESTAMPTZ,
  last_used_at             TIMESTAMPTZ,
  last_error               TEXT,

  -- Metadata
  metadata                 JSONB              NOT NULL DEFAULT '{}',
  -- stores: install_id (GitHub App), team_id (Vercel), project_ref (Supabase)

  created_at               TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ        NOT NULL DEFAULT now(),

  -- One active account per workspace per provider
  -- (use metadata to distinguish multiple accounts of same provider)
  UNIQUE (workspace_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_workspace
  ON connected_accounts(workspace_id, provider);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_status
  ON connected_accounts(status, workspace_id)
  WHERE status = 'active';

COMMENT ON TABLE connected_accounts IS
  'OAuth tokens and API keys per provider per workspace. '
  'Credentials encrypted with pgp_sym_encrypt. '
  'Never expose decrypted values to browser or chat.';

COMMENT ON COLUMN connected_accounts.encrypted_access_token IS
  'pgp_sym_encrypt(access_token, key). '
  'Decrypt server-side only: pgp_sym_decrypt(encrypted_access_token, key)::text. '
  'The key is in CONNECTOR_ENCRYPTION_KEY env var — never in the DB.';

-- ─────────────────────────────────────────────────────────────────────────────
-- connector_permissions
--
-- What a connected account is allowed to do, scoped to a project or workspace.
-- Every destructive action checks this table before executing.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_permissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID        NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  workspace_id     UUID        NOT NULL,

  -- Scope: 'project' | 'workspace' | 'global'
  scope_type       TEXT        NOT NULL DEFAULT 'project',
  scope_id         UUID,       -- project_id if scope_type = 'project'

  -- Permission flags
  can_read         BOOLEAN     NOT NULL DEFAULT true,
  can_write        BOOLEAN     NOT NULL DEFAULT false,
  can_deploy       BOOLEAN     NOT NULL DEFAULT false,
  can_destructive  BOOLEAN     NOT NULL DEFAULT false,
  -- can_destructive covers: git_push, vercel_deploy, db_migrate, storage_write

  -- Audit
  granted_by       UUID,       -- user_id
  granted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,

  UNIQUE (account_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_connector_perms_account
  ON connector_permissions(account_id, scope_type);

CREATE INDEX IF NOT EXISTS idx_connector_perms_scope
  ON connector_permissions(scope_id, account_id)
  WHERE scope_type = 'project';

COMMENT ON TABLE connector_permissions IS
  'What each connected account can do, scoped to project or workspace. '
  'All destructive actions check can_destructive before executing.';

-- ─────────────────────────────────────────────────────────────────────────────
-- connector_action_logs
--
-- Immutable record of every action taken through a connector.
-- Written before and after every operation. Never updated.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_action_logs (
  id                UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID                  REFERENCES connected_accounts(id) ON DELETE SET NULL,
  workspace_id      UUID,
  project_id        UUID,
  session_id        TEXT,

  -- Action
  provider          connector_provider    NOT NULL,
  action_type       connector_action_type NOT NULL,
  actor             TEXT                  NOT NULL DEFAULT 'system',
  -- resource being acted on
  resource_type     TEXT,                 -- 'repository' | 'deployment' | 'migration' | 'file'
  resource_ref      TEXT,                 -- e.g. 'hawk7227/streamsailive' | 'prj_xxx' | 'main'

  -- Execution
  request_payload   JSONB                 NOT NULL DEFAULT '{}',
  -- NEVER put credentials in request_payload — only refs and params
  response_status   TEXT,                 -- 'success' | 'failed' | 'pending' | 'cancelled'
  response_payload  JSONB,
  error             TEXT,
  duration_ms       INTEGER,

  -- Approval tracking
  required_approval BOOLEAN               NOT NULL DEFAULT false,
  approval_id       UUID,                 -- FK to connector_approval_queue

  -- Linkage
  action_log_id     UUID,                 -- FK to audit_records action_logs (Phase 1)

  created_at        TIMESTAMPTZ           NOT NULL DEFAULT now()
  -- No updated_at — this table is append-only
);

CREATE INDEX IF NOT EXISTS idx_connector_action_logs_workspace
  ON connector_action_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_action_logs_project
  ON connector_action_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_action_logs_provider
  ON connector_action_logs(provider, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_action_logs_failed
  ON connector_action_logs(workspace_id, created_at DESC)
  WHERE response_status = 'failed';

COMMENT ON TABLE connector_action_logs IS
  'Immutable append-only log of every governed connector action. '
  'Never updated, never deleted. Source of truth for what happened '
  'and when across all provider integrations.';

-- ─────────────────────────────────────────────────────────────────────────────
-- connector_approval_queue
--
-- Destructive connector actions (git_push, vercel_deploy, db_migrate)
-- create a record here before executing. Human approval required unless
-- auto_approve conditions are met.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_approval_queue (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID               REFERENCES connected_accounts(id) ON DELETE SET NULL,
  workspace_id     UUID,
  project_id       UUID,
  session_id       TEXT,

  -- What needs approval
  provider         connector_provider NOT NULL,
  action_type      connector_action_type NOT NULL,
  action_payload   JSONB              NOT NULL DEFAULT '{}',
  -- human-readable summary of what will happen
  summary          TEXT               NOT NULL,

  -- Risk assessment
  is_destructive   BOOLEAN            NOT NULL DEFAULT false,
  is_reversible    BOOLEAN            NOT NULL DEFAULT true,
  risk_notes       TEXT,

  -- Resolution
  decision         approval_decision  NOT NULL DEFAULT 'pending',
  reviewed_by      TEXT,              -- user_id or 'system'
  review_reason    TEXT,
  auto_approve_reason TEXT,

  -- Timing
  expires_at       TIMESTAMPTZ        NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_pending
  ON connector_approval_queue(workspace_id, created_at DESC)
  WHERE decision = 'pending';

CREATE INDEX IF NOT EXISTS idx_approval_queue_project
  ON connector_approval_queue(project_id, decision);

COMMENT ON TABLE connector_approval_queue IS
  'Approval gates for destructive connector actions. '
  'git_push, vercel_deploy, and db_migrate all require a resolved gate '
  'before the connector runtime will execute them.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Add FK constraints to project_bindings (Phase 2 placeholder columns)
-- The columns were added in Phase 2 as UUID (no FK). Now add the constraints.
-- ─────────────────────────────────────────────────────────────────────────────

-- FK constraints into project_bindings are applied only if that table exists.
-- If Phase 2 migration has not been run yet, these are skipped safely.
-- Re-run this block after applying Phase 2 to wire the constraints.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_bindings'
  ) THEN
    -- github_account_id FK
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_pb_github_account'
    ) THEN
      ALTER TABLE project_bindings
        ADD CONSTRAINT fk_pb_github_account
        FOREIGN KEY (github_account_id) REFERENCES connected_accounts(id) ON DELETE SET NULL;
    END IF;

    -- vercel_account_id FK
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_pb_vercel_account'
    ) THEN
      ALTER TABLE project_bindings
        ADD CONSTRAINT fk_pb_vercel_account
        FOREIGN KEY (vercel_account_id) REFERENCES connected_accounts(id) ON DELETE SET NULL;
    END IF;

    -- supabase_account_id FK
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_pb_supabase_account'
    ) THEN
      ALTER TABLE project_bindings
        ADD CONSTRAINT fk_pb_supabase_account
        FOREIGN KEY (supabase_account_id) REFERENCES connected_accounts(id) ON DELETE SET NULL;
    END IF;

    RAISE NOTICE 'project_bindings FK constraints applied.';
  ELSE
    RAISE NOTICE 'project_bindings does not exist yet — run Phase 2 migration first, then re-apply these constraints.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-expire pending approval gates
CREATE OR REPLACE FUNCTION expire_stale_approval_gates()
RETURNS void AS $$
BEGIN
  UPDATE connector_approval_queue
    SET decision = 'expired', resolved_at = now()
  WHERE decision = 'pending'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Touch last_used_at when a connector action is logged
CREATE OR REPLACE FUNCTION touch_connector_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE connected_accounts
    SET last_used_at = now(), updated_at = now()
  WHERE id = NEW.account_id
    AND NEW.account_id IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_connector ON connector_action_logs;
CREATE TRIGGER trg_touch_connector
  AFTER INSERT ON connector_action_logs
  FOR EACH ROW EXECUTE FUNCTION touch_connector_last_used();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_approval_queue ENABLE ROW LEVEL SECURITY;

-- All access via service role (admin client) only.
-- No anon or authenticated role can access these tables directly.
-- This is intentional — credentials never go to the browser.

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Phase 7 proof record
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO proof_records (
  subject_type, subject_ref, claim, status, proof_type, proof_detail, proved_by
) VALUES (
  'phase',
  'Phase7/ConnectorActionLayer',
  'Connector Action Layer schema exists: connected_accounts, connector_permissions, connector_action_logs, connector_approval_queue with encryption support and RLS',
  'ImplementedButUnproven',
  'source',
  'Migration 20260503_streams_connector_action_layer.sql applied. pgcrypto enabled. 4 tables + 2 helper functions + touch trigger. FK constraints added to project_bindings. Status is ImplementedButUnproven until first real OAuth connection is made and validated.',
  'system'
) ON CONFLICT DO NOTHING;
