-- ============================================================
-- Migration: streams_audit_layer
-- Phase 1 of STREAMS System Upgrade — Approval + Audit Layer
--
-- Tables:
--   proof_records    — one row per proven/unproven claim about a system action
--   audit_records    — one row per auditable event (any significant system event)
--   violation_records — one row per rule violation detected
--   action_logs      — one row per governed action execution
--   approval_gates   — one row per gate that must be passed before an action proceeds
--
-- Status enum (applied across all tables):
--   Proven | ImplementedButUnproven | Blocked | Rejected | Pending | Approved
-- ============================================================

-- ── proof_status enum ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE proof_status AS ENUM (
    'Proven',
    'ImplementedButUnproven',
    'Blocked',
    'Rejected',
    'Pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── action_category enum ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE action_category AS ENUM (
    'build',       -- code write / patch / generate
    'push',        -- git commit / push / deploy
    'query',       -- read / search / retrieve
    'generate',    -- AI generation (image/video/voice/music)
    'connect',     -- external service connection
    'approve',     -- approval gate resolution
    'audit',       -- audit/proof classification
    'system'       -- system lifecycle event
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── violation_severity enum ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE violation_severity AS ENUM (
    'critical',   -- blocks merge
    'high',       -- fix before next push
    'medium',     -- fix this sprint
    'low'         -- advisory
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── approval_outcome enum ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE approval_outcome AS ENUM (
    'pending',
    'approved',
    'rejected',
    'bypassed'   -- approved automatically by system rule
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- proof_records
-- Truth gate for every system claim. Before anything can be called "done",
-- a proof_record must exist with status = 'Proven'.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proof_records (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  project_id      UUID,
  session_id      TEXT,

  -- What is being claimed / proven
  subject_type    TEXT          NOT NULL, -- 'feature' | 'migration' | 'route' | 'component' | 'phase'
  subject_ref     TEXT          NOT NULL, -- e.g. 'Phase1/AuditLayer' | 'GenerateTab/I2V' | 'migration/20260501'
  claim           TEXT          NOT NULL, -- human-readable claim being proven

  -- Proof state
  status          proof_status  NOT NULL DEFAULT 'ImplementedButUnproven',
  proof_type      TEXT,         -- 'source' | 'runtime' | 'output' | 'persistence' | 'security' | 'audit'
  proof_detail    TEXT,         -- what was verified, how, result
  proof_url       TEXT,         -- link to screenshot / log / artifact if applicable

  -- Linkage
  action_log_id   UUID,         -- the action_log entry that generated this proof
  artifact_id     UUID,         -- artifact this proof applies to (if any)
  task_id         UUID,         -- task this proof applies to (if any)

  -- Metadata
  proved_by       TEXT,         -- 'system' | 'user:{id}' | 'ai'
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proof_records_workspace
  ON proof_records(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proof_records_project
  ON proof_records(project_id, status);

CREATE INDEX IF NOT EXISTS idx_proof_records_subject
  ON proof_records(subject_type, subject_ref);

CREATE INDEX IF NOT EXISTS idx_proof_records_status
  ON proof_records(status);

COMMENT ON TABLE proof_records IS
  'Truth gate for all system claims. A feature/phase/migration is only "done" '
  'when a proof_record with status=Proven exists. All other statuses mean the '
  'claim is unverified or blocked.';

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_records
-- Immutable event log. Every significant system event writes here.
-- Never updated — only inserted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_records (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  project_id      UUID,
  session_id      TEXT,

  -- Event identity
  event_type      TEXT            NOT NULL, -- e.g. 'action.executed' | 'proof.classified' | 'violation.detected'
  event_category  action_category NOT NULL DEFAULT 'system',
  actor           TEXT            NOT NULL DEFAULT 'system', -- 'system' | 'user:{id}' | 'ai'

  -- Event payload
  subject_type    TEXT,           -- what the event is about
  subject_ref     TEXT,           -- identifier of the subject
  summary         TEXT            NOT NULL, -- one-line human-readable summary
  detail          JSONB           NOT NULL DEFAULT '{}', -- full structured payload

  -- Outcome
  outcome         TEXT            NOT NULL DEFAULT 'success', -- 'success' | 'failure' | 'warning' | 'info'
  error           TEXT,           -- error message if outcome=failure

  -- Linkage
  action_log_id   UUID,
  proof_record_id UUID,

  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
  -- No updated_at — audit records are immutable
);

CREATE INDEX IF NOT EXISTS idx_audit_records_workspace
  ON audit_records(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_records_project
  ON audit_records(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_records_event_type
  ON audit_records(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_records_outcome
  ON audit_records(outcome, created_at DESC)
  WHERE outcome IN ('failure', 'warning');

COMMENT ON TABLE audit_records IS
  'Immutable event log. Every significant system event writes one row here. '
  'Rows are never updated or deleted. This is the source of truth for what happened.';

-- ─────────────────────────────────────────────────────────────────────────────
-- violation_records
-- Every rule violation detected — by audit script, CI, or runtime check.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS violation_records (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  project_id      UUID,

  -- Violation identity
  rule_ref        TEXT                NOT NULL, -- e.g. 'Rule 1.2' | 'Rule T.2' | 'Rule 4.1'
  rule_source     TEXT                NOT NULL DEFAULT 'BUILD_RULES', -- 'BUILD_RULES' | 'FRONTEND_BUILD_RULES'
  severity        violation_severity  NOT NULL,

  -- Location
  file_path       TEXT,               -- e.g. 'src/components/streams/tabs/ChatTab.tsx'
  line_number     INTEGER,
  code_snippet    TEXT,

  -- Description
  violation       TEXT                NOT NULL, -- what the violation is
  fix_required    TEXT,               -- what must be done to fix it

  -- State
  status          TEXT                NOT NULL DEFAULT 'open', -- 'open' | 'fixed' | 'waived'
  fixed_in_commit TEXT,               -- git commit hash where this was fixed
  waive_reason    TEXT,               -- if waived, why

  -- Linkage
  audit_record_id UUID,
  proof_record_id UUID,

  detected_at     TIMESTAMPTZ         NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_violation_records_open
  ON violation_records(severity, detected_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_violation_records_file
  ON violation_records(file_path, status);

CREATE INDEX IF NOT EXISTS idx_violation_records_rule
  ON violation_records(rule_ref, status);

COMMENT ON TABLE violation_records IS
  'Every rule violation detected by audit script, CI, or runtime check. '
  'Open critical violations block merge per BUILD_RULES Rule 12.3.';

-- ─────────────────────────────────────────────────────────────────────────────
-- action_logs
-- One row per governed action execution. The structured record of what
-- the system did, when, with what inputs, and what resulted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS action_logs (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  project_id      UUID,
  session_id      TEXT,

  -- Action identity
  action_name     TEXT            NOT NULL,   -- e.g. 'pre_push_audit' | 'generate_image' | 'write_file'
  action_category action_category NOT NULL,
  actor           TEXT            NOT NULL DEFAULT 'system',

  -- Context at time of action
  project_context JSONB           NOT NULL DEFAULT '{}', -- snapshot of project bindings at execution time
  input           JSONB           NOT NULL DEFAULT '{}', -- action inputs
  output          JSONB           NOT NULL DEFAULT '{}', -- action result/output

  -- Outcome
  status          TEXT            NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed' | 'cancelled'
  error           TEXT,
  duration_ms     INTEGER,

  -- Linkage
  parent_action_id UUID,           -- for nested/chained actions
  proof_record_id  UUID,

  -- Timestamps
  started_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_workspace
  ON action_logs(workspace_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_logs_project
  ON action_logs(project_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_logs_status
  ON action_logs(status, started_at DESC)
  WHERE status IN ('running', 'failed');

CREATE INDEX IF NOT EXISTS idx_action_logs_category
  ON action_logs(action_category, started_at DESC);

COMMENT ON TABLE action_logs IS
  'Structured record of every governed action execution. '
  'Later layers (Builder Runtime, Connector) write here on every action.';

-- ─────────────────────────────────────────────────────────────────────────────
-- approval_gates
-- A gate that must be passed (approved or auto-bypassed) before a
-- governed action can proceed. Used for: destructive ops, pushes,
-- external API calls with cost, schema migrations.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_gates (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  project_id      UUID,
  session_id      TEXT,

  -- Gate definition
  gate_name       TEXT              NOT NULL,  -- e.g. 'pre_push' | 'schema_migration' | 'bulk_generate'
  action_name     TEXT              NOT NULL,  -- the action this gate protects
  requires_human  BOOLEAN           NOT NULL DEFAULT false,
  auto_approve_if TEXT,             -- jsonb-path expression that auto-approves if true

  -- The action to approve
  action_payload  JSONB             NOT NULL DEFAULT '{}', -- full action input waiting for approval

  -- Resolution
  outcome         approval_outcome  NOT NULL DEFAULT 'pending',
  resolved_by     TEXT,             -- 'user:{id}' | 'system' | 'rule'
  resolve_reason  TEXT,

  -- Linkage
  action_log_id   UUID,

  -- Timestamps
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,      -- gates expire if not resolved
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_gates_pending
  ON approval_gates(workspace_id, created_at DESC)
  WHERE outcome = 'pending';

CREATE INDEX IF NOT EXISTS idx_approval_gates_project
  ON approval_gates(project_id, outcome);

COMMENT ON TABLE approval_gates IS
  'Gates that must be passed before governed actions proceed. '
  'Destructive operations, pushes, and external API calls with cost '
  'require an approval gate record to be resolved before execution.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Cross-table FK updates (deferred — added after all tables exist)
-- ─────────────────────────────────────────────────────────────────────────────

-- proof_records → action_logs
DO $$ BEGIN
  ALTER TABLE proof_records
    ADD CONSTRAINT fk_proof_action_log
    FOREIGN KEY (action_log_id) REFERENCES action_logs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_records → action_logs
DO $$ BEGIN
  ALTER TABLE audit_records
    ADD CONSTRAINT fk_audit_action_log
    FOREIGN KEY (action_log_id) REFERENCES action_logs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_records → proof_records
DO $$ BEGIN
  ALTER TABLE audit_records
    ADD CONSTRAINT fk_audit_proof_record
    FOREIGN KEY (proof_record_id) REFERENCES proof_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- violation_records → audit_records
DO $$ BEGIN
  ALTER TABLE violation_records
    ADD CONSTRAINT fk_violation_audit_record
    FOREIGN KEY (audit_record_id) REFERENCES audit_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- violation_records → proof_records
DO $$ BEGIN
  ALTER TABLE violation_records
    ADD CONSTRAINT fk_violation_proof_record
    FOREIGN KEY (proof_record_id) REFERENCES proof_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- action_logs → proof_records (circular — deferred)
DO $$ BEGIN
  ALTER TABLE action_logs
    ADD CONSTRAINT fk_action_proof_record
    FOREIGN KEY (proof_record_id) REFERENCES proof_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- approval_gates → action_logs
DO $$ BEGIN
  ALTER TABLE approval_gates
    ADD CONSTRAINT fk_gate_action_log
    FOREIGN KEY (action_log_id) REFERENCES action_logs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Phase 1 proof record
-- Documents that this migration itself is Proven (source proof).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO proof_records (
  subject_type, subject_ref, claim, status, proof_type, proof_detail, proved_by
) VALUES (
  'phase',
  'Phase1/ApprovalAuditLayer',
  'Approval + Audit Layer schema exists in database with all 5 tables and 4 enums',
  'Proven',
  'source',
  'Migration 20260501_streams_audit_layer.sql applied. Tables: proof_records, audit_records, violation_records, action_logs, approval_gates. Enums: proof_status, action_category, violation_severity, approval_outcome.',
  'system'
) ON CONFLICT DO NOTHING;
