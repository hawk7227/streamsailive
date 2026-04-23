/**
 * src/lib/audit/types.ts
 *
 * TypeScript contracts for the STREAMS Approval + Audit Layer (Phase 1).
 *
 * These types mirror the Supabase schema in:
 *   supabase/migrations/20260501_streams_audit_layer.sql
 *
 * Every governed action in STREAMS produces records using these types.
 * No action is "done" until a ProofRecord with status="Proven" exists.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type ProofStatus =
  | "Proven"
  | "ImplementedButUnproven"
  | "Blocked"
  | "Rejected"
  | "Pending";

export type ActionCategory =
  | "build"     // code write / patch / generate
  | "push"      // git commit / push / deploy
  | "query"     // read / search / retrieve
  | "generate"  // AI generation (image/video/voice/music)
  | "connect"   // external service connection
  | "approve"   // approval gate resolution
  | "audit"     // audit/proof classification
  | "system";   // system lifecycle event

export type ViolationSeverity = "critical" | "high" | "medium" | "low";

export type ApprovalOutcome = "pending" | "approved" | "rejected" | "bypassed";

export type ActionStatus = "running" | "completed" | "failed" | "cancelled";

export type ViolationStatus = "open" | "fixed" | "waived";

export type RuleSource = "BUILD_RULES" | "FRONTEND_BUILD_RULES";

// ── Core record types ─────────────────────────────────────────────────────────

export interface ProofRecord {
  id: string;
  workspace_id: string | null;
  project_id: string | null;
  session_id: string | null;

  subject_type: string;   // 'feature' | 'migration' | 'route' | 'component' | 'phase'
  subject_ref: string;    // e.g. 'Phase1/AuditLayer' | 'GenerateTab/I2V'
  claim: string;          // human-readable claim being proven

  status: ProofStatus;
  proof_type: string | null;   // 'source' | 'runtime' | 'output' | 'persistence' | 'security' | 'audit'
  proof_detail: string | null;
  proof_url: string | null;

  action_log_id: string | null;
  artifact_id: string | null;
  task_id: string | null;

  proved_by: string;   // 'system' | 'user:{id}' | 'ai'
  created_at: string;
  updated_at: string;
}

export interface AuditRecord {
  id: string;
  workspace_id: string | null;
  project_id: string | null;
  session_id: string | null;

  event_type: string;
  event_category: ActionCategory;
  actor: string;

  subject_type: string | null;
  subject_ref: string | null;
  summary: string;
  detail: Record<string, unknown>;

  outcome: "success" | "failure" | "warning" | "info";
  error: string | null;

  action_log_id: string | null;
  proof_record_id: string | null;

  created_at: string;
  // No updated_at — audit records are immutable
}

export interface ViolationRecord {
  id: string;
  workspace_id: string | null;
  project_id: string | null;

  rule_ref: string;          // e.g. 'Rule 1.2' | 'Rule T.2'
  rule_source: RuleSource;
  severity: ViolationSeverity;

  file_path: string | null;
  line_number: number | null;
  code_snippet: string | null;

  violation: string;
  fix_required: string | null;

  status: ViolationStatus;
  fixed_in_commit: string | null;
  waive_reason: string | null;

  audit_record_id: string | null;
  proof_record_id: string | null;

  detected_at: string;
  resolved_at: string | null;
}

export interface ActionLog {
  id: string;
  workspace_id: string | null;
  project_id: string | null;
  session_id: string | null;

  action_name: string;
  action_category: ActionCategory;
  actor: string;

  project_context: Record<string, unknown>;
  input: Record<string, unknown>;
  output: Record<string, unknown>;

  status: ActionStatus;
  error: string | null;
  duration_ms: number | null;

  parent_action_id: string | null;
  proof_record_id: string | null;

  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface ApprovalGate {
  id: string;
  workspace_id: string | null;
  project_id: string | null;
  session_id: string | null;

  gate_name: string;
  action_name: string;
  requires_human: boolean;
  auto_approve_if: string | null;

  action_payload: Record<string, unknown>;

  outcome: ApprovalOutcome;
  resolved_by: string | null;
  resolve_reason: string | null;

  action_log_id: string | null;

  created_at: string;
  expires_at: string | null;
  resolved_at: string | null;
}

// ── Input types (for writes) ──────────────────────────────────────────────────

export interface CreateProofRecordInput {
  workspace_id?: string;
  project_id?: string;
  session_id?: string;
  subject_type: string;
  subject_ref: string;
  claim: string;
  status?: ProofStatus;
  proof_type?: string;
  proof_detail?: string;
  proof_url?: string;
  action_log_id?: string;
  artifact_id?: string;
  task_id?: string;
  proved_by?: string;
}

export interface CreateAuditRecordInput {
  workspace_id?: string;
  project_id?: string;
  session_id?: string;
  event_type: string;
  event_category?: ActionCategory;
  actor?: string;
  subject_type?: string;
  subject_ref?: string;
  summary: string;
  detail?: Record<string, unknown>;
  outcome?: "success" | "failure" | "warning" | "info";
  error?: string;
  action_log_id?: string;
  proof_record_id?: string;
}

export interface CreateViolationRecordInput {
  workspace_id?: string;
  project_id?: string;
  rule_ref: string;
  rule_source?: RuleSource;
  severity: ViolationSeverity;
  file_path?: string;
  line_number?: number;
  code_snippet?: string;
  violation: string;
  fix_required?: string;
  audit_record_id?: string;
  proof_record_id?: string;
}

export interface CreateActionLogInput {
  workspace_id?: string;
  project_id?: string;
  session_id?: string;
  action_name: string;
  action_category: ActionCategory;
  actor?: string;
  project_context?: Record<string, unknown>;
  input?: Record<string, unknown>;
  parent_action_id?: string;
}

export interface CreateApprovalGateInput {
  workspace_id?: string;
  project_id?: string;
  session_id?: string;
  gate_name: string;
  action_name: string;
  requires_human?: boolean;
  auto_approve_if?: string;
  action_payload: Record<string, unknown>;
  action_log_id?: string;
  expires_at?: string;
}

// ── Proof panel summary type ──────────────────────────────────────────────────

export interface ProofPanelSummary {
  phase: string;
  subject_ref: string;
  claim: string;
  status: ProofStatus;
  proof_type: string | null;
  proof_detail: string | null;
  proved_by: string;
  updated_at: string;
}

export interface AuditPanelEntry {
  id: string;
  event_type: string;
  event_category: ActionCategory;
  actor: string;
  summary: string;
  outcome: string;
  error: string | null;
  created_at: string;
}

export interface ViolationPanelEntry {
  id: string;
  rule_ref: string;
  rule_source: RuleSource;
  severity: ViolationSeverity;
  file_path: string | null;
  violation: string;
  fix_required: string | null;
  status: ViolationStatus;
  detected_at: string;
}

// ── Repository result wrapper ─────────────────────────────────────────────────

export type AuditResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; detail?: string } };

export function auditOk<T>(data: T): AuditResult<T> {
  return { data, error: null };
}

export function auditErr(code: string, message: string, detail?: string): AuditResult<never> {
  return { data: null, error: { code, message, detail } };
}
