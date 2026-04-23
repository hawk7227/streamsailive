/**
 * GET /api/audit/proof
 *
 * Returns proof panel data: proof records, recent audit events,
 * open violations, and pending approval gates.
 *
 * Query params:
 *   workspaceId — filter by workspace
 *   projectId   — filter by project (takes precedence over workspaceId)
 *
 * Used by: Proof/Audit panel in the Builder Workspace (Phase 10)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getProofPanel,
  getRecentAuditEvents,
  getOpenViolations,
  getPendingGates,
} from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const workspaceId = searchParams.get("workspaceId") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;

  const [proofResult, auditResult, violationResult, gatesResult] =
    await Promise.all([
      getProofPanel(workspaceId, projectId),
      getRecentAuditEvents({ workspaceId, projectId, limit: 30 }),
      getOpenViolations({ workspaceId, projectId }),
      getPendingGates(workspaceId),
    ]);

  // Count by status
  const proofSummary = {
    proven: 0,
    implementedButUnproven: 0,
    blocked: 0,
    rejected: 0,
    pending: 0,
  };

  for (const r of proofResult.data ?? []) {
    if (r.status === "Proven") proofSummary.proven++;
    else if (r.status === "ImplementedButUnproven") proofSummary.implementedButUnproven++;
    else if (r.status === "Blocked") proofSummary.blocked++;
    else if (r.status === "Rejected") proofSummary.rejected++;
    else proofSummary.pending++;
  }

  // Count violations by severity
  const violationSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  for (const v of violationResult.data ?? []) {
    violationSummary[v.severity]++;
    violationSummary.total++;
  }

  return NextResponse.json({
    proof: {
      summary: proofSummary,
      records: proofResult.data ?? [],
    },
    audit: {
      recent: auditResult.data ?? [],
    },
    violations: {
      summary: violationSummary,
      open: violationResult.data ?? [],
    },
    approvalGates: {
      pending: gatesResult.data ?? [],
      pendingCount: gatesResult.data?.length ?? 0,
    },
    errors: [
      proofResult.error ? `proof: ${proofResult.error.message}` : null,
      auditResult.error ? `audit: ${auditResult.error.message}` : null,
      violationResult.error ? `violations: ${violationResult.error.message}` : null,
      gatesResult.error ? `gates: ${gatesResult.error.message}` : null,
    ].filter(Boolean),
  });
}
