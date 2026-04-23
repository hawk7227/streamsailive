/**
 * src/lib/audit/runtime.ts
 *
 * Runtime helper for the STREAMS Approval + Audit Layer.
 *
 * Every governed action in STREAMS goes through one of:
 *   - withAudit()       — wraps any async operation with action_log + audit_record
 *   - classifyAction()  — maps an action name to its category and gate requirements
 *   - requiresGate()    — returns true if the action needs an approval gate
 *   - logViolations()   — writes violation records from an audit script result
 *   - proveSubject()    — upserts a proof_record for a subject
 *
 * Hook points for later phases:
 *   Phase 2 (Project Context) will call withAudit() from the context loader.
 *   Phase 6 (Builder Runtime) will wrap every tool call with withAudit().
 *   Phase 7 (Connector) will gate destructive connector actions through requiresGate().
 *   Phase 8 (Pre-Push) runs logViolations() after every audit script execution.
 */

import {
  startActionLog,
  completeActionLog,
  failActionLog,
  createAuditRecord,
  createViolationRecord,
  createProofRecord,
  updateProofStatus,
  getProofBySubject,
} from "./repository";
import type {
  ActionCategory,
  ViolationSeverity,
  RuleSource,
  ProofStatus,
  ActionLog,
} from "./types";

// ── Action classification ─────────────────────────────────────────────────────

interface ActionClassification {
  category: ActionCategory;
  requiresGate: boolean;
  gateType: "human" | "auto" | "none";
  riskLevel: "critical" | "high" | "medium" | "low";
}

const ACTION_REGISTRY: Record<string, ActionClassification> = {
  // Build actions
  write_file:            { category: "build",    requiresGate: false, gateType: "none",  riskLevel: "medium" },
  patch_file:            { category: "build",    requiresGate: false, gateType: "none",  riskLevel: "medium" },
  delete_file:           { category: "build",    requiresGate: true,  gateType: "auto",  riskLevel: "high" },
  run_build:             { category: "build",    requiresGate: false, gateType: "none",  riskLevel: "low" },

  // Push actions — always gated
  git_commit:            { category: "push",     requiresGate: true,  gateType: "auto",  riskLevel: "medium" },
  git_push:              { category: "push",     requiresGate: true,  gateType: "human", riskLevel: "critical" },
  pre_push_audit:        { category: "push",     requiresGate: false, gateType: "none",  riskLevel: "low" },
  vercel_deploy:         { category: "push",     requiresGate: true,  gateType: "human", riskLevel: "critical" },

  // Query actions — never gated
  read_file:             { category: "query",    requiresGate: false, gateType: "none",  riskLevel: "low" },
  search_files:          { category: "query",    requiresGate: false, gateType: "none",  riskLevel: "low" },
  list_artifacts:        { category: "query",    requiresGate: false, gateType: "none",  riskLevel: "low" },

  // Generate actions
  generate_image:        { category: "generate", requiresGate: false, gateType: "none",  riskLevel: "medium" },
  generate_video:        { category: "generate", requiresGate: false, gateType: "none",  riskLevel: "medium" },
  generate_voice:        { category: "generate", requiresGate: false, gateType: "none",  riskLevel: "medium" },
  generate_music:        { category: "generate", requiresGate: false, gateType: "none",  riskLevel: "medium" },
  bulk_generate:         { category: "generate", requiresGate: true,  gateType: "auto",  riskLevel: "high" },

  // Connect actions — always gated
  connect_github:        { category: "connect",  requiresGate: true,  gateType: "human", riskLevel: "critical" },
  connect_vercel:        { category: "connect",  requiresGate: true,  gateType: "human", riskLevel: "critical" },
  connect_supabase:      { category: "connect",  requiresGate: true,  gateType: "human", riskLevel: "critical" },
  revoke_connector:      { category: "connect",  requiresGate: true,  gateType: "human", riskLevel: "critical" },

  // Approve actions
  approve_gate:          { category: "approve",  requiresGate: false, gateType: "none",  riskLevel: "low" },
  reject_gate:           { category: "approve",  requiresGate: false, gateType: "none",  riskLevel: "low" },

  // Audit actions
  run_audit_script:      { category: "audit",    requiresGate: false, gateType: "none",  riskLevel: "low" },
  classify_proof:        { category: "audit",    requiresGate: false, gateType: "none",  riskLevel: "low" },
  record_violation:      { category: "audit",    requiresGate: false, gateType: "none",  riskLevel: "low" },

  // System actions
  start_session:         { category: "system",   requiresGate: false, gateType: "none",  riskLevel: "low" },
  load_project_context:  { category: "system",   requiresGate: false, gateType: "none",  riskLevel: "low" },
  write_memory:          { category: "system",   requiresGate: false, gateType: "none",  riskLevel: "low" },
};

export function classifyAction(actionName: string): ActionClassification {
  return ACTION_REGISTRY[actionName] ?? {
    category: "system",
    requiresGate: false,
    gateType: "none",
    riskLevel: "medium",
  };
}

export function requiresGate(actionName: string): boolean {
  return classifyAction(actionName).requiresGate;
}

// ── withAudit — wrap any async operation ─────────────────────────────────────

interface WithAuditOptions {
  actionName: string;
  actor?: string;
  workspaceId?: string;
  projectId?: string;
  sessionId?: string;
  projectContext?: Record<string, unknown>;
  input?: Record<string, unknown>;
  parentActionId?: string;
}

interface WithAuditResult<T> {
  data: T | null;
  actionLog: ActionLog | null;
  error: string | null;
  durationMs: number;
}

/**
 * Wraps any async operation with:
 * 1. A started action_log record
 * 2. An audit_record on completion or failure
 * 3. A completed/failed action_log record
 *
 * Use this for every governed action in STREAMS.
 *
 * @example
 * const { data, error } = await withAudit({
 *   actionName: "generate_image",
 *   workspaceId: workspace.id,
 *   input: { prompt, model },
 * }, () => generateImage({ prompt, model }));
 */
export async function withAudit<T>(
  opts: WithAuditOptions,
  operation: (actionLogId: string) => Promise<T>
): Promise<WithAuditResult<T>> {
  const classification = classifyAction(opts.actionName);
  const startedAt = Date.now();

  // 1. Start action log
  const logResult = await startActionLog({
    workspace_id: opts.workspaceId,
    project_id: opts.projectId,
    session_id: opts.sessionId,
    action_name: opts.actionName,
    action_category: classification.category,
    actor: opts.actor ?? "system",
    project_context: opts.projectContext ?? {},
    input: opts.input ?? {},
    parent_action_id: opts.parentActionId,
  });

  const actionLogId = logResult.data?.id;

  try {
    // 2. Execute the operation
    const result = await operation(actionLogId ?? "");
    const durationMs = Date.now() - startedAt;

    // 3. Complete action log
    if (actionLogId) {
      await completeActionLog(
        actionLogId,
        typeof result === "object" && result !== null
          ? (result as Record<string, unknown>)
          : { result },
        durationMs
      );
    }

    // 4. Write audit record (success)
    await createAuditRecord({
      workspace_id: opts.workspaceId,
      project_id: opts.projectId,
      session_id: opts.sessionId,
      event_type: `${opts.actionName}.completed`,
      event_category: classification.category,
      actor: opts.actor ?? "system",
      summary: `${opts.actionName} completed successfully`,
      detail: { input: opts.input, durationMs },
      outcome: "success",
      action_log_id: actionLogId,
    });

    return {
      data: result,
      actionLog: logResult.data,
      error: null,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // 5. Fail action log
    if (actionLogId) {
      await failActionLog(actionLogId, errorMsg, durationMs);
    }

    // 6. Write audit record (failure)
    await createAuditRecord({
      workspace_id: opts.workspaceId,
      project_id: opts.projectId,
      session_id: opts.sessionId,
      event_type: `${opts.actionName}.failed`,
      event_category: classification.category,
      actor: opts.actor ?? "system",
      summary: `${opts.actionName} failed: ${errorMsg}`,
      detail: { input: opts.input, durationMs, error: errorMsg },
      outcome: "failure",
      error: errorMsg,
      action_log_id: actionLogId,
    });

    return {
      data: null,
      actionLog: logResult.data,
      error: errorMsg,
      durationMs,
    };
  }
}

// ── logViolations — write violation records from audit script output ──────────

export interface AuditFinding {
  ruleRef: string;
  ruleSource?: RuleSource;
  severity: ViolationSeverity;
  filePath?: string;
  lineNumber?: number;
  codeSnippet?: string;
  violation: string;
  fixRequired?: string;
}

export async function logViolations(
  findings: AuditFinding[],
  opts: {
    workspaceId?: string;
    projectId?: string;
    auditRecordId?: string;
  } = {}
): Promise<void> {
  // Write each finding as a violation_record
  await Promise.allSettled(
    findings.map((f) =>
      createViolationRecord({
        workspace_id: opts.workspaceId,
        project_id: opts.projectId,
        rule_ref: f.ruleRef,
        rule_source: f.ruleSource ?? "BUILD_RULES",
        severity: f.severity,
        file_path: f.filePath,
        line_number: f.lineNumber,
        code_snippet: f.codeSnippet,
        violation: f.violation,
        fix_required: f.fixRequired,
        audit_record_id: opts.auditRecordId,
      })
    )
  );

  // Write a summary audit record
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  await createAuditRecord({
    workspace_id: opts.workspaceId,
    project_id: opts.projectId,
    event_type: "audit_script.completed",
    event_category: "audit",
    summary: `Audit found ${findings.length} violation(s): ${criticalCount} critical, ${highCount} high`,
    detail: {
      total: findings.length,
      critical: criticalCount,
      high: highCount,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    },
    outcome: criticalCount > 0 ? "failure" : highCount > 0 ? "warning" : "success",
    action_log_id: opts.auditRecordId,
  });
}

// ── proveSubject — upsert a proof record for a subject ref ───────────────────

export async function proveSubject(opts: {
  subjectType: string;
  subjectRef: string;
  claim: string;
  status: ProofStatus;
  proofType?: string;
  proofDetail?: string;
  proofUrl?: string;
  workspaceId?: string;
  projectId?: string;
  actionLogId?: string;
  provedBy?: string;
}): Promise<void> {
  // Check if a proof record already exists for this subject
  const existing = await getProofBySubject(opts.subjectRef);

  if (existing.data) {
    // Update existing record
    await updateProofStatus(existing.data.id, opts.status, opts.proofDetail);
  } else {
    // Create new proof record
    await createProofRecord({
      workspace_id: opts.workspaceId,
      project_id: opts.projectId,
      subject_type: opts.subjectType,
      subject_ref: opts.subjectRef,
      claim: opts.claim,
      status: opts.status,
      proof_type: opts.proofType,
      proof_detail: opts.proofDetail,
      proof_url: opts.proofUrl,
      action_log_id: opts.actionLogId,
      proved_by: opts.provedBy ?? "system",
    });
  }

  // Write audit record for this classification
  await createAuditRecord({
    workspace_id: opts.workspaceId,
    project_id: opts.projectId,
    event_type: "proof.classified",
    event_category: "audit",
    subject_type: opts.subjectType,
    subject_ref: opts.subjectRef,
    summary: `Proof classified: ${opts.subjectRef} → ${opts.status}`,
    detail: {
      claim: opts.claim,
      status: opts.status,
      proofType: opts.proofType,
    },
    outcome: opts.status === "Proven" ? "success"
      : opts.status === "Blocked" || opts.status === "Rejected" ? "failure"
      : "info",
  });
}
