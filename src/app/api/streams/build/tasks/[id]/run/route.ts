import { NextResponse } from "next/server";
import { createProofReport, evaluateFullBuildGate, getBuildTask, getWorkspaceCapabilities, markBlocked, runCheckSuite, runDeterministicRepairs, updateBuildTask } from "@/lib/streams/build-runtime";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getBuildTask(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const caps = getWorkspaceCapabilities();
  if (caps.local_workspace_available !== "real") {
    const blocked = markBlocked(id, "No build workspace runner is configured.");
    return NextResponse.json({ task: blocked, blocked: true, proof: createProofReport(id) });
  }
  const checks = Array.isArray(body?.checks) ? body.checks : ["git_diff_check", "scope_guard", "generated_file_guard"];
  const results = await runCheckSuite(id, checks);
  const current = getBuildTask(id);
  if (!current) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const repairActions = runDeterministicRepairs(current);
  const gate = evaluateFullBuildGate(current, results, current.changedFiles);
  if (!gate.passed) updateBuildTask(id, { classification: "Blocked", blockedReason: gate.failures.join("; ") });
  return NextResponse.json({ task: getBuildTask(id), checks: results, repairs: repairActions, gate, proof: createProofReport(id), blocked: !gate.passed });
}
