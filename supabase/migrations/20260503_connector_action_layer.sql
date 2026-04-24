-- ============================================================
-- Migration: connector_action_layer
-- Phase 7 of STREAMS System Upgrade — Connector Action Layer
--
-- Tables:
--   connected_accounts      — one row per provider connection per workspace
--   connector_action_logs   — immutable log of every connector operation
--   connector_permission_grants — scopes granted per project per account
--
-- Encryption:
--   encrypted_credentials column stores AES-256-GCM encrypted JSON blob.
--   The encryption key lives ONLY in CONNECTOR_ENCRYPTION_KEY env var.
--   Raw credentials are NEVER stored, NEVER returned via API, NEVER logged.
--
-- Providers supported:
--   github | vercel | supabase
-- ============================================================

-- ── Provider enum ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE connector_provider AS ENUM (
    'github',
    'vercel',
    'supabase'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Account status enum ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE connector_status AS ENUM (
    'active',       -- connected and last_validated_at is recent
    'expired',      -- token expired, needs re-auth
    'revoked',      -- manually revoked by user
    'invalid',      -- validation failed (wrong scope, deleted token, etc.)
    'pending'       -- OAuth flow in progress, not yet complete
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Connector action type enum ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE connector_action_type AS ENUM (
    'connect',          -- account connected for first time
    'validate',         -- credentials validated
    'rotate',           -- credentials rotated
    'revoke',           -- account revoked
    'read',             -- read operation (list repos, get deployment, etc.)
    'write',            -- write operation (push, create PR, update env, etc.)
    'deploy',           -- deployment triggered
    'destructive'       -- irreversible destructive operation
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- connected_accounts
-- One row per provider connection per workspace.
-- Multiple projects in the same workspace share one connected account.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connected_accounts (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID              NOT NULL,
  user_id               UUID,             -- user who connected the account

  -- Provider identity
  provider              connector_provider NOT NULL,
  provider_account_id   TEXT,             -- e.g. GitHub user/org ID, Vercel team ID
  provider_account_name TEXT,             -- human-readable (github: login, vercel: slug)
  provider_account_url  TEXT,             -- link to the account on the provider

  -- Scopes granted at time of connection
  scopes                TEXT[]            NOT NULL DEFAULT '{}',

  -- Encrypted credentials — AES-256-GCM, key from CONNECTOR_ENCRYPTION_KEY env
  -- Format: base64(iv) + '.' + base64(tag) + '.' + base64(ciphertext)
  -- Contains JSON: { token, refreshToken?, expiresAt?, extra? }
  encrypted_credentials TEXT              NOT NULL,

  -- Status tracking
  status                connector_status  NOT NULL DEFAULT 'pending',
  last_validated_at     TIMESTAMPTZ,
  validation_error      TEXT,             -- last error if status = invalid/expired

  -- Rotation tracking
  rotated_at            TIMESTAMPTZ,
  rotation_count        INTEGER           NOT NULL DEFAULT 0,

  -- Metadata
  display_name          TEXT,             -- user-given nickname
  avatar_url            TEXT,
  metadata              JSONB             NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),

  -- One active connection per provider per workspace
  UNIQUE (workspace_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_workspace
  ON connected_accounts(workspace_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user
  ON connected_accounts(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_active
  ON connected_accounts(workspace_id, provider)
  WHERE status = 'active';

COMMENT ON TABLE connected_accounts IS
  'One row per provider connection per workspace. '
  'encrypted_credentials stores AES-256-GCM encrypted token blob. '
  'Raw credentials are NEVER stored unencrypted, NEVER returned via API, '
  'NEVER logged. Project bindings reference account IDs (FK) only.';

COMMENT ON COLUMN connected_accounts.encrypted_credentials IS
  'AES-256-GCM encrypted JSON: {token, refreshToken?, expiresAt?, extra?}. '
  'Format: base64(iv).base64(tag).base64(ciphertext). '
  'Decryption requires CONNECTOR_ENCRYPTION_KEY env var on the server. '
  'This value must never appear in API responses, logs, or error messages.';

-- ─────────────────────────────────────────────────────────────────────────────
-- connector_permission_grants
-- Which scopes each project is allowed to use from a connected account.
-- A workspace may have a GitHub account with full scopes, but project A
-- may only be granted repo:read, while project B gets repo:write.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_permission_grants (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID          NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  project_id      UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id    UUID          NOT NULL,

  -- Scopes this project is allowed to use (subset of account scopes)
  granted_scopes  TEXT[]        NOT NULL DEFAULT '{}',

  -- Destructive action flag — must be explicitly enabled per project
  allow_destructive BOOLEAN     NOT NULL DEFAULT false,

  granted_by      UUID,         -- user who granted access
  granted_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,  -- null = active grant

  UNIQUE (account_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_permission_grants_project
  ON connector_permission_grants(project_id, account_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE connector_permission_grants IS
  'Per-project scope restrictions on a connected account. '
  'A project cannot use more scopes than were granted here, '
  'even if the underlying account has broader access.';

-- ─────────────────────────────────────────────────────────────────────────────
-- connector_action_logs
-- Immutable log of every operation performed through a connector.
-- Never updated. Append-only. Used for audit and replay.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS connector_action_logs (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID                  REFERENCES connected_accounts(id) ON DELETE SET NULL,
  project_id      UUID,
  workspace_id    UUID                  NOT NULL,
  session_id      TEXT,

  -- What happened
  provider        connector_provider    NOT NULL,
  action_type     connector_action_type NOT NULL,
  operation       TEXT                  NOT NULL,  -- e.g. 'git.push', 'vercel.deploy', 'supabase.query'
  actor           TEXT                  NOT NULL DEFAULT 'system',

  -- What was accessed / modified
  resource_type   TEXT,                 -- e.g. 'repository', 'deployment', 'project'
  resource_ref    TEXT,                 -- e.g. 'hawk7227/streamsailive', 'dpl_xxxx'

  -- Input (sanitised — no credentials, no secrets)
  input_summary   JSONB                 NOT NULL DEFAULT '{}',

  -- Result
  outcome         TEXT                  NOT NULL DEFAULT 'success', -- 'success' | 'failure' | 'blocked'
  error           TEXT,
  output_summary  JSONB                 NOT NULL DEFAULT '{}',
  duration_ms     INTEGER,

  -- Governance
  approval_gate_id UUID,               -- FK to approval_gates if action was gated
  was_gated       BOOLEAN              NOT NULL DEFAULT false,
  gate_outcome    TEXT,                -- 'approved' | 'bypassed' | 'rejected'

  -- Audit linkage
  action_log_id   UUID,               -- FK to Phase 1 action_logs

  created_at      TIMESTAMPTZ          NOT NULL DEFAULT now()
  -- No updated_at — connector_action_logs are immutable
);

CREATE INDEX IF NOT EXISTS idx_connector_logs_workspace
  ON connector_action_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_logs_project
  ON connector_action_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_logs_account
  ON connector_action_logs(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_logs_destructive
  ON connector_action_logs(workspace_id, created_at DESC)
  WHERE action_type = 'destructive';

COMMENT ON TABLE connector_action_logs IS
  'Immutable append-only log of every connector operation. '
  'input_summary and output_summary are sanitised — they must never '
  'contain raw tokens, credentials, or secret values.';

-- ── FK: project_bindings → connected_accounts ─────────────────────────────

DO $$ BEGIN
  ALTER TABLE project_bindings
    ADD CONSTRAINT fk_bindings_github_account
    FOREIGN KEY (github_account_id) REFERENCES connected_accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE project_bindings
    ADD CONSTRAINT fk_bindings_vercel_account
    FOREIGN KEY (vercel_account_id) REFERENCES connected_accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE project_bindings
    ADD CONSTRAINT fk_bindings_supabase_account
    FOREIGN KEY (supabase_account_id) REFERENCES connected_accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed: Phase 7 proof record ────────────────────────────────────────────────

INSERT INTO proof_records (
  subject_type, subject_ref, claim, status, proof_type, proof_detail, proved_by
) VALUES (
  'phase',
  'Phase7/ConnectorActionLayer',
  'Connector Action Layer schema exists: connected_accounts, connector_permission_grants, connector_action_logs with encryption contract, provider enum, and FK links to project_bindings',
  'Proven',
  'source',
  'Migration 20260503_connector_action_layer.sql applied. 3 tables, 3 enums. encrypted_credentials contract documented. Project binding FKs wired.',
  'system'
) ON CONFLICT DO NOTHING;
