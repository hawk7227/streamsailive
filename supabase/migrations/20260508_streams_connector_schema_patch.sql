-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: streams_connector_schema_align (patch)
-- 
-- The Streams connector lib (src/lib/streams/connectors/) was written against
-- the Phase 7 schema (20250424000003_streams_connector_layer.sql) which uses:
--   encrypted_credentials TEXT
--   project_id UUID
--   rotation_due_at TIMESTAMPTZ
--   validation_error TEXT
--   connected_at TIMESTAMPTZ
--
-- The deployed table (20260503_streams_connector_action_layer.sql) uses:
--   encrypted_access_token BYTEA
--   token_hint TEXT
--
-- This migration adds the missing columns so the code works without a
-- full lib rewrite.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add encrypted_credentials TEXT column if it doesn't exist
-- (the lib stores base64 AES-GCM output here)
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT;

-- Add project_id for workspace-vs-project scoping
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS project_id UUID;

-- Add rotation tracking
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS rotation_due_at TIMESTAMPTZ;
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

-- Add validation error storage
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS validation_error TEXT;

-- Add connected_by (user who created the connection)
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS connected_by UUID REFERENCES auth.users(id);

-- Add revoked_by / revoked_at
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id);
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Rename created_at → connected_at if connected_at doesn't exist
-- (lib orders by connected_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='connected_accounts' AND column_name='connected_at'
  ) THEN
    ALTER TABLE connected_accounts RENAME COLUMN created_at TO connected_at;
    ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    UPDATE connected_accounts SET created_at = connected_at WHERE created_at IS NULL;
  END IF;
END $$;

-- Add last_validated_at if missing
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- Drop and recreate the unique constraint to match what the route uses:
-- (workspace_id, provider) — one connection per provider per workspace
DO $$
BEGIN
  -- Drop the old 3-column unique constraint if it exists
  ALTER TABLE connected_accounts
    DROP CONSTRAINT IF EXISTS connected_accounts_workspace_id_provider_provider_account_id_key;
  -- Add simpler 2-column unique if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connected_accounts_workspace_provider_unique'
  ) THEN
    ALTER TABLE connected_accounts
      ADD CONSTRAINT connected_accounts_workspace_provider_unique
      UNIQUE (workspace_id, provider);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add index on connected_at for ordering
CREATE INDEX IF NOT EXISTS idx_connected_accounts_connected_at
  ON connected_accounts(workspace_id, connected_at DESC);
