import { NextResponse } from "next/server";
import { getBuildTask } from "@/lib/streams/build-runtime";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getBuildTask(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ checks: task.checks, status: task.status });
}
