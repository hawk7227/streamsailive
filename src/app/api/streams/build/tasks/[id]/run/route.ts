import { NextResponse } from "next/server";
import { createProofReport, getBuildTask, markBlocked, getWorkspaceCapabilities } from "@/lib/streams/build-runtime";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getBuildTask(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const caps = getWorkspaceCapabilities();
  if (caps.local_workspace_available !== "real") {
    const blocked = markBlocked(id, "No build workspace runner is configured.");
    return NextResponse.json({ task: blocked, proof: createProofReport(id), blocked: true, blockedReason: blocked?.blockedReason }, { status: 200 });
  }
  return NextResponse.json({ task, blocked: false });
}
