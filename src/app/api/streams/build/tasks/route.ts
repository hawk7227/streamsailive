import { NextResponse } from "next/server";
import { createBuildTask, getWorkspaceCapabilities } from "@/lib/streams/build-runtime";

export async function POST(request: Request) {
  const body = await request.json();
  const task = createBuildTask({
    title: String(body.title ?? "Build task"),
    prompt: String(body.prompt ?? ""),
    activeSlice: String(body.activeSlice ?? ""),
    baseBranch: String(body.baseBranch ?? "work"),
    allowedFiles: Array.isArray(body.allowedFiles) ? body.allowedFiles : [],
    forbiddenFiles: Array.isArray(body.forbiddenFiles) ? body.forbiddenFiles : [],
  });

  return NextResponse.json({ task, capabilitySummary: getWorkspaceCapabilities(), classification: task.classification }, { status: 201 });
}
