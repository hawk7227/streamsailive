/**
 * src/lib/audit/repository.ts
 *
 * Database access layer for the STREAMS Approval + Audit Layer.
 * All reads and writes to the 5 audit tables go through this file.
 *
 * Uses the Supabase admin client (service role) — these records are
 * written server-side by the runtime and never exposed directly to
 * the browser client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ProofRecord,
  AuditRecord,
  ViolationRecord,
  ActionLog,
  ApprovalGate,
  CreateProofRecordInput,
  CreateAuditRecordInput,
  CreateViolationRecordInput,
  CreateActionLogInput,
  CreateApprovalGateInput,
  ProofPanelSummary,
  AuditPanelEntry,
  ViolationPanelEntry,
  ProofStatus,
  ViolationSeverity,
  AuditResult,
} from "./types";
import { auditOk, auditErr } from "./types";

// ── Proof Records ─────────────────────────────────────────────────────────────

export async function createProofRecord(
  input: CreateProofRecordInput
): Promise<AuditResult<ProofRecord>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("proof_records")
      .insert({
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        session_id: input.session_id ?? null,
        subject_type: input.subject_type,
        subject_ref: input.subject_ref,
        claim: input.claim,
        status: input.status ?? "ImplementedButUnproven",
        proof_type: input.proof_type ?? null,
        proof_detail: input.proof_detail ?? null,
        proof_url: input.proof_url ?? null,
        action_log_id: input.action_log_id ?? null,
        artifact_id: input.artifact_id ?? null,
        task_id: input.task_id ?? null,
        proved_by: input.proved_by ?? "system",
      })
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message, error.code);
    return auditOk(data as ProofRecord);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function updateProofStatus(
  id: string,
  status: ProofStatus,
  detail?: string
): Promise<AuditResult<ProofRecord>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("proof_records")
      .update({
        status,
        proof_detail: detail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ProofRecord);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function getProofBySubject(
  subjectRef: string
): Promise<AuditResult<ProofRecord | null>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("proof_records")
      .select()
      .eq("subject_ref", subjectRef)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ProofRecord | null);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function getProofPanel(
  workspaceId?: string,
  projectId?: string
): Promise<AuditResult<ProofPanelSummary[]>> {
  try {
    const db = createAdminClient();
    let query = db
      .from("proof_records")
      .select("subject_type, subject_ref, claim, status, proof_type, proof_detail, proved_by, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (projectId) query = query.eq("project_id", projectId);
    else if (workspaceId) query = query.eq("workspace_id", workspaceId);

    const { data, error } = await query;
    if (error) return auditErr("DB_ERROR", error.message);

    return auditOk(
      (data ?? []).map((r) => ({
        phase: r.subject_type,
        subject_ref: r.subject_ref,
        claim: r.claim,
        status: r.status as ProofStatus,
        proof_type: r.proof_type,
        proof_detail: r.proof_detail,
        proved_by: r.proved_by,
        updated_at: r.updated_at,
      }))
    );
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

// ── Audit Records ─────────────────────────────────────────────────────────────

export async function createAuditRecord(
  input: CreateAuditRecordInput
): Promise<AuditResult<AuditRecord>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("audit_records")
      .insert({
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        session_id: input.session_id ?? null,
        event_type: input.event_type,
        event_category: input.event_category ?? "system",
        actor: input.actor ?? "system",
        subject_type: input.subject_type ?? null,
        subject_ref: input.subject_ref ?? null,
        summary: input.summary,
        detail: input.detail ?? {},
        outcome: input.outcome ?? "success",
        error: input.error ?? null,
        action_log_id: input.action_log_id ?? null,
        proof_record_id: input.proof_record_id ?? null,
      })
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as AuditRecord);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function getRecentAuditEvents(
  opts: {
    workspaceId?: string;
    projectId?: string;
    eventType?: string;
    outcome?: string;
    limit?: number;
  }
): Promise<AuditResult<AuditPanelEntry[]>> {
  try {
    const db = createAdminClient();
    let query = db
      .from("audit_records")
      .select("id, event_type, event_category, actor, summary, outcome, error, created_at")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 30);

    if (opts.projectId) query = query.eq("project_id", opts.projectId);
    else if (opts.workspaceId) query = query.eq("workspace_id", opts.workspaceId);
    if (opts.eventType) query = query.eq("event_type", opts.eventType);
    if (opts.outcome) query = query.eq("outcome", opts.outcome);

    const { data, error } = await query;
    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as AuditPanelEntry[]);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

// ── Violation Records ─────────────────────────────────────────────────────────

export async function createViolationRecord(
  input: CreateViolationRecordInput
): Promise<AuditResult<ViolationRecord>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("violation_records")
      .insert({
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        rule_ref: input.rule_ref,
        rule_source: input.rule_source ?? "BUILD_RULES",
        severity: input.severity,
        file_path: input.file_path ?? null,
        line_number: input.line_number ?? null,
        code_snippet: input.code_snippet ?? null,
        violation: input.violation,
        fix_required: input.fix_required ?? null,
        audit_record_id: input.audit_record_id ?? null,
        proof_record_id: input.proof_record_id ?? null,
        status: "open",
      })
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ViolationRecord);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function markViolationFixed(
  id: string,
  commitHash: string
): Promise<AuditResult<ViolationRecord>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("violation_records")
      .update({
        status: "fixed",
        fixed_in_commit: commitHash,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ViolationRecord);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function getOpenViolations(opts: {
  workspaceId?: string;
  projectId?: string;
  severity?: ViolationSeverity;
}): Promise<AuditResult<ViolationPanelEntry[]>> {
  try {
    const db = createAdminClient();
    let query = db
      .from("violation_records")
      .select("id, rule_ref, rule_source, severity, file_path, violation, fix_required, status, detected_at")
      .eq("status", "open")
      .order("detected_at", { ascending: false })
      .limit(100);

    if (opts.projectId) query = query.eq("project_id", opts.projectId);
    else if (opts.workspaceId) query = query.eq("workspace_id", opts.workspaceId);
    if (opts.severity) query = query.eq("severity", opts.severity);

    const { data, error } = await query;
    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ViolationPanelEntry[]);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

// ── Action Logs ───────────────────────────────────────────────────────────────

export async function startActionLog(
  input: CreateActionLogInput
): Promise<AuditResult<ActionLog>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("action_logs")
      .insert({
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        session_id: input.session_id ?? null,
        action_name: input.action_name,
        action_category: input.action_category,
        actor: input.actor ?? "system",
        project_context: input.project_context ?? {},
        input: input.input ?? {},
        output: {},
        status: "running",
        parent_action_id: input.parent_action_id ?? null,
      })
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ActionLog);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function completeActionLog(
  id: string,
  output: Record<string, unknown>,
  durationMs: number
): Promise<AuditResult<ActionLog>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("action_logs")
      .update({
        status: "completed",
        output,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ActionLog);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function failActionLog(
  id: string,
  errorMsg: string,
  durationMs: number
): Promise<AuditResult<ActionLog>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("action_logs")
      .update({
        status: "failed",
        error: errorMsg,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ActionLog);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

// ── Approval Gates ────────────────────────────────────────────────────────────

export async function createApprovalGate(
  input: CreateApprovalGateInput
): Promise<AuditResult<ApprovalGate>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("approval_gates")
      .insert({
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        session_id: input.session_id ?? null,
        gate_name: input.gate_name,
        action_name: input.action_name,
        requires_human: input.requires_human ?? false,
        auto_approve_if: input.auto_approve_if ?? null,
        action_payload: input.action_payload,
        outcome: "pending",
        action_log_id: input.action_log_id ?? null,
        expires_at: input.expires_at ?? null,
      })
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ApprovalGate);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function resolveApprovalGate(
  id: string,
  outcome: "approved" | "rejected" | "bypassed",
  resolvedBy: string,
  reason?: string
): Promise<AuditResult<ApprovalGate>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("approval_gates")
      .update({
        outcome,
        resolved_by: resolvedBy,
        resolve_reason: reason ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ApprovalGate);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}

export async function getPendingGates(
  workspaceId?: string
): Promise<AuditResult<ApprovalGate[]>> {
  try {
    const db = createAdminClient();
    let query = db
      .from("approval_gates")
      .select()
      .eq("outcome", "pending")
      .order("created_at", { ascending: false });

    if (workspaceId) query = query.eq("workspace_id", workspaceId);

    const { data, error } = await query;
    if (error) return auditErr("DB_ERROR", error.message);
    return auditOk(data as ApprovalGate[]);
  } catch (err) {
    return auditErr("UNEXPECTED", String(err));
  }
}
