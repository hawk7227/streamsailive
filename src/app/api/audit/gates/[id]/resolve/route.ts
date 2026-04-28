/**
 * POST /api/audit/gates/[id]/resolve
 *
 * Resolves a pending approval gate.
 *
 * Body: { outcome: "approved" | "rejected", reason?: string }
 *
 * Used by: Approval panel UI (Phase 10) and the pre-push operator
 * workflow (Phase 8) when human approval is required.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveApprovalGate, createAuditRecord } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gateId } = await params;
  if (!gateId) {
    return NextResponse.json({ error: "Gate ID is required" }, { status: 400 });
  }

  let body: { outcome: string; reason?: string; resolvedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { outcome, reason, resolvedBy } = body;

  if (!["approved", "rejected", "bypassed"].includes(outcome)) {
    return NextResponse.json(
      { error: "outcome must be 'approved', 'rejected', or 'bypassed'" },
      { status: 400 }
    );
  }

  const result = await resolveApprovalGate(
    gateId,
    outcome as "approved" | "rejected" | "bypassed",
    resolvedBy ?? "user",
    reason
  );

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // Write audit record for the resolution
  await createAuditRecord({
    workspace_id: result.data?.workspace_id ?? undefined,
    project_id: result.data?.project_id ?? undefined,
    event_type: `approval_gate.${outcome}`,
    event_category: "approve",
    actor: resolvedBy ?? "user",
    subject_type: "approval_gate",
    subject_ref: gateId,
    summary: `Approval gate ${outcome}: ${result.data?.gate_name} — ${reason ?? "no reason given"}`,
    detail: {
      gateId,
      gateName: result.data?.gate_name,
      actionName: result.data?.action_name,
      outcome,
      reason,
    },
    outcome: outcome === "rejected" ? "failure" : "success",
  });

  return NextResponse.json({ gate: result.data });
}
