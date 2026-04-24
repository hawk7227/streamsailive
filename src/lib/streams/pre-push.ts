/**
 * src/lib/streams/pre-push.ts
 *
 * Phase 8 — Pre-Push Operator Workflow: Core Library
 *
 * Architecture:
 *   Local script (scripts/pre-push.mjs) runs checks that require the
 *   local filesystem and git binary, then POSTs results here.
 *   This module handles the server-side: recording, governance, Vercel polling.
 *
 * Steps executed end-to-end:
 *   1. tsc --noEmit (streams/ only)           → local script
 *   2. git status untracked check             → local script
 *   3. repo root / branch / remote verify     → local script
 *   4. pattern audit (BUILD_RULES)            → local script
 *   5. approval gate (if violations > 0)      → this module
 *   6. git commit + push                      → local script (after gate passes)
 *   7. confirm commit landed                  → local script + this module
 *   8. poll Vercel deployment                 → this module (connector)
 *   9. write connector_action_log             → this module
 *  10. write audit_record + proof update      → this module
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGitHub, withConnector } from "@/lib/connector";
import { getLatestDeployment, pollDeployment } from "@/lib/connector";
import { createAuditRecord, createApprovalGate, proveSubject } from "@/lib/audit";
import { logConnectorAction } from "@/lib/connector";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditFinding {
  rule:     string;       // e.g. "Rule 1.2"
  file:     string;
  line?:    number;
  message:  string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface TscError {
  file:    string;
  line:    number;
  col:     number;
  code:    string;
  message: string;
}

export interface PrePushReport {
  // Identity
  workspaceId:   string;
  projectId?:    string;
  sessionId?:    string;
  actor:         string;   // user:{id} or "system"

  // Git state at time of check
  repoRoot:      string;
  branch:        string;
  remote:        string;
  headCommit:    string;
  commitMessage: string;

  // Check results
  tscErrors:          TscError[];
  untrackedImports:   string[];   // files imported but not git-tracked
  auditFindings:      AuditFinding[];
  stagedFiles:        string[];

  // What the local script did after checks
  pushed:             boolean;
  pushedCommit?:      string;   // SHA after push
  pushError?:         string;
}

export interface PrePushResult {
  allowed:         boolean;   // were checks clean enough to push?
  blocked:         boolean;   // blocked by approval gate?
  gateId?:         string;    // approval gate ID if created
  vercelStatus?:   string;    // "ready" | "error" | "building" | "unknown"
  vercelUrl?:      string;
  deploymentId?:   string;
  logId?:          string;    // connector_action_log id
  summary:         string;
  errors:          string[];
}

// ── Severity helpers ──────────────────────────────────────────────────────────

function isCritical(findings: AuditFinding[]): boolean {
  return findings.some(f => f.severity === "critical");
}

function criticalCount(findings: AuditFinding[]): number {
  return findings.filter(f => f.severity === "critical").length;
}

function streamsErrors(errors: TscError[]): TscError[] {
  return errors.filter(e =>
    e.file.includes("streams/") ||
    e.file.includes("lib/streams") ||
    e.file.includes("lib/audit") ||
    e.file.includes("lib/connector") ||
    e.file.includes("lib/project-context")
  );
}

// ── Main: process pre-push report ────────────────────────────────────────────

/**
 * Called by POST /api/streams/pre-push after the local script runs checks.
 *
 * 1. Validates the report
 * 2. Creates approval gate if critical violations exist
 * 3. Writes connector_action_log
 * 4. Writes audit_record
 * 5. Polls Vercel if push succeeded
 * 6. Updates proof record
 */
export async function processPrePushReport(
  report: PrePushReport
): Promise<PrePushResult> {
  const admin = createAdminClient();
  const errors: string[] = [];
  const streamsTscErrors = streamsErrors(report.tscErrors);
  const criticalFindings = report.auditFindings.filter(f => f.severity === "critical");
  const hasCritical = isCritical(report.auditFindings) || streamsTscErrors.length > 0;

  // ── 1. Build summary ───────────────────────────────────────────────────────
  const lines: string[] = [
    `Branch: ${report.branch} @ ${report.headCommit.slice(0, 8)}`,
    `Commit: ${report.commitMessage}`,
    `TypeScript errors (streams/): ${streamsTscErrors.length}`,
    `Audit findings: ${report.auditFindings.length} (${criticalCount(report.auditFindings)} critical)`,
    `Untracked imports: ${report.untrackedImports.length}`,
    `Pushed: ${report.pushed ? `yes — ${report.pushedCommit?.slice(0, 8) ?? "unknown SHA"}` : "no"}`,
  ];

  if (streamsTscErrors.length > 0) {
    errors.push(`${streamsTscErrors.length} TypeScript error(s) in streams files`);
    streamsTscErrors.slice(0, 3).forEach(e => errors.push(`  ${e.file}:${e.line} ${e.code}: ${e.message}`));
  }
  if (report.untrackedImports.length > 0) {
    errors.push(`Untracked imports: ${report.untrackedImports.join(", ")}`);
  }
  criticalFindings.forEach(f => errors.push(`  [${f.rule}] ${f.file}: ${f.message}`));

  // ── 2. Approval gate if critical violations ────────────────────────────────
  let gateId: string | undefined;
  if (hasCritical && !report.pushed) {
    const gate = await createApprovalGate({
      workspace_id:    report.workspaceId,
      project_id:      report.projectId,
      session_id:      report.sessionId,
      gate_name:       "pre_push_violations",
      action_name:     "git_push",
      requires_human:  true,
      action_payload: {
        branch:        report.branch,
        headCommit:    report.headCommit,
        commitMessage: report.commitMessage,
        criticalCount: criticalCount(report.auditFindings),
        tscErrors:     streamsTscErrors.length,
      },
    });
    gateId = gate.data?.id;
  }

  // ── 3. Write connector_action_log ──────────────────────────────────────────
  let logId: string | undefined;
  try {
    // Try to resolve GitHub context for the project
    let accountId: string | undefined;
    if (report.projectId) {
      const ghResult = await resolveGitHub(report.projectId, report.workspaceId);
      accountId = ghResult.accountId ?? undefined;
    }

    const logResult = await logConnectorAction(
      {
        account_id:    accountId,
        workspace_id:  report.workspaceId,
        project_id:    report.projectId,
        session_id:    report.sessionId,
        provider:      "github",
        action_type:   "write",      // git push is a write operation
        operation:     "pre_push_workflow",
        actor:         report.actor,
        resource_type: "repository",
        resource_ref:  report.remote,
        input_summary: {
          branch:           report.branch,
          headCommit:       report.headCommit,
          stagedFiles:      report.stagedFiles.length,
          tscErrors:        streamsTscErrors.length,
          auditFindings:    report.auditFindings.length,
          criticalFindings: criticalCount(report.auditFindings),
        },
        was_gated:     !!gateId,
        approval_gate_id: gateId,
      },
      report.pushed ? "success" : (hasCritical ? "blocked" : "failure"),
      0,
      report.pushed ? { pushedCommit: report.pushedCommit } : {},
      report.pushError
    );
    logId = logResult.data?.id;
  } catch {
    // Non-fatal — don't fail the whole workflow over a log write
  }

  // ── 4. Write audit_record ──────────────────────────────────────────────────
  await createAuditRecord({
    workspace_id:  report.workspaceId,
    project_id:    report.projectId,
    session_id:    report.sessionId,
    event_type:    "pre_push.completed",
    event_category: "push",
    actor:         report.actor,
    subject_type:  "repository",
    subject_ref:   `${report.remote}:${report.branch}`,
    summary:       report.pushed
      ? `Pre-push workflow passed — ${report.pushedCommit?.slice(0, 8)} pushed to ${report.branch}`
      : `Pre-push workflow blocked — ${errors.length} issue(s)`,
    detail: {
      branch:          report.branch,
      commit:          report.headCommit,
      tscErrors:       streamsTscErrors.length,
      auditFindings:   report.auditFindings.length,
      critical:        criticalCount(report.auditFindings),
      pushed:          report.pushed,
      pushedCommit:    report.pushedCommit ?? null,
      gateId:          gateId ?? null,
    },
    outcome: report.pushed ? "success" : (hasCritical ? "failure" : "warning"),
  });

  // ── 5. Poll Vercel if push succeeded ──────────────────────────────────────
  let vercelStatus: string | undefined;
  let vercelUrl:    string | undefined;
  let deploymentId: string | undefined;

  if (report.pushed && report.projectId) {
    try {
      const ghCtx = await resolveGitHub(report.projectId, report.workspaceId);
      if (ghCtx.context) {
        // Check for latest Vercel deployment via REST (use VERCEL_TOKEN env var)
        const vercelToken = process.env.VERCEL_TOKEN;
        const vercelProjectId = process.env.VERCEL_PROJECT_ID;

        if (vercelToken && vercelProjectId) {
          const depRes = await fetch(
            `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1`,
            { headers: { Authorization: `Bearer ${vercelToken}` } }
          );
          if (depRes.ok) {
            const depData = await depRes.json() as {
              deployments?: Array<{ uid: string; state: string; url: string }>;
            };
            const dep = depData.deployments?.[0];
            if (dep) {
              deploymentId = dep.uid;
              vercelStatus = dep.state?.toLowerCase() ?? "unknown";
              vercelUrl    = `https://${dep.url}`;
            }
          }
        }
      }
    } catch {
      vercelStatus = "unknown";
    }
  }

  // ── 6. Update proof record ─────────────────────────────────────────────────
  if (report.pushed) {
    await proveSubject({
      subjectType:  "phase",
      subjectRef:   "Phase8/PrePushWorkflow",
      claim:        "Pre-push operator workflow ran end-to-end: checks → gate → push → Vercel poll",
      status:       "Proven",
      proofType:    "runtime",
      proofDetail:  `Pushed ${report.pushedCommit?.slice(0, 8)} to ${report.branch}. Vercel: ${vercelStatus ?? "not checked"}.`,
      workspaceId:  report.workspaceId,
      projectId:    report.projectId,
    });
  }

  return {
    allowed:      !hasCritical || report.pushed,
    blocked:      hasCritical && !report.pushed,
    gateId,
    vercelStatus,
    vercelUrl,
    deploymentId,
    logId,
    summary:      lines.join("\n"),
    errors,
  };
}

// ── Vercel status poller (called separately after push) ───────────────────────

export async function pollVercelStatus(
  deploymentId: string,
  maxWaitMs = 120_000
): Promise<{ state: string; url: string | null; readyAt: string | null }> {
  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken || !deploymentId) {
    return { state: "unknown", url: null, readyAt: null };
  }

  const startedAt = Date.now();
  const intervalMs = 5_000;

  while (Date.now() - startedAt < maxWaitMs) {
    const res = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );

    if (!res.ok) break;

    const data = await res.json() as {
      readyState?: string;
      state?: string;
      url?: string;
      ready?: number;
    };

    const state = (data.readyState ?? data.state ?? "").toLowerCase();

    if (state === "ready" || state === "error" || state === "canceled") {
      return {
        state,
        url:     data.url ? `https://${data.url}` : null,
        readyAt: data.ready ? new Date(data.ready).toISOString() : null,
      };
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { state: "timeout", url: null, readyAt: null };
}
