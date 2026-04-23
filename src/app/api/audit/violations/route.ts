/**
 * POST /api/audit/violations
 *
 * Ingests violation findings from an audit script run and writes them
 * to violation_records. Called by the pre-push operator workflow (Phase 8)
 * after running the pattern audit script.
 *
 * Body:
 * {
 *   findings: AuditFinding[]
 *   workspaceId?: string
 *   projectId?: string
 *   commitHash?: string   // if this is a post-push verification
 * }
 *
 * Returns:
 * {
 *   written: number
 *   critical: number
 *   blocking: boolean     // true if any critical violations exist
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { logViolations } from "@/lib/audit";
import type { AuditFinding } from "@/lib/audit";

export async function POST(req: NextRequest) {
  let body: {
    findings: AuditFinding[];
    workspaceId?: string;
    projectId?: string;
    commitHash?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { findings, workspaceId, projectId } = body;

  if (!Array.isArray(findings)) {
    return NextResponse.json({ error: "findings must be an array" }, { status: 400 });
  }

  await logViolations(findings, { workspaceId, projectId });

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;

  return NextResponse.json({
    written: findings.length,
    critical,
    high,
    blocking: critical > 0, // critical violations block merge per BUILD_RULES Rule 12.3
  });
}
