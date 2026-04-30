/**
 * GET  /api/streams/tasks?projectId=&status=&priority=&ownerType=&limit=
 * POST /api/streams/tasks
 *
 * Public /streams test mode is allowed only when the request explicitly uses
 * TEST_USER_ID. When no real workspace is available in test mode, GET returns
 * an empty collection instead of a 401 so the UI can stay mounted cleanly.
 */

import { NextResponse } from "next/server";
import { resolveStreamsRouteContext, isFallbackTestWorkspace } from "@/lib/streams/test-mode-auth";
import { createTask, listTasks } from "@/lib/streams/tasks";
import type { TaskStatus, TaskPriority, TaskOwnerType } from "@/lib/streams/tasks";

export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveStreamsRouteContext({ request, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = ctx.workspaceId;
  if (!workspaceId || (ctx.isTestMode && isFallbackTestWorkspace(workspaceId))) {
    return NextResponse.json({ data: [], testMode: ctx.isTestMode, persisted: false });
  }

  const { searchParams } = new URL(request.url);
  const data = await listTasks(ctx.admin, workspaceId, {
    projectId: searchParams.get("projectId") ?? undefined,
    status: searchParams.get("status") as TaskStatus | undefined,
    priority: searchParams.get("priority") as TaskPriority | undefined,
    ownerType: searchParams.get("ownerType") as TaskOwnerType | undefined,
    ownerUserId: searchParams.get("ownerUserId") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });

  return NextResponse.json({ data, testMode: ctx.isTestMode, persisted: true });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ctx = await resolveStreamsRouteContext({
    request,
    body,
    requireWorkspace: false,
    allowTestMode: true,
  });

  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = (typeof body.workspaceId === "string" && body.workspaceId) || ctx.workspaceId;
  if (!workspaceId || (ctx.isTestMode && isFallbackTestWorkspace(workspaceId))) {
    return NextResponse.json(
      { error: "Task writes require a real workspace. Set STREAMS_TEST_WORKSPACE_ID or sign in." },
      { status: 503 },
    );
  }

  const { title } = body;
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const task = await createTask(ctx.admin, ctx.userId, {
      workspaceId,
      projectId: body.projectId as string | undefined,
      title,
      description: body.description as string | undefined,
      priority: body.priority as TaskPriority | undefined,
      ownerType: body.ownerType as TaskOwnerType | undefined,
      ownerUserId: body.ownerUserId as string | undefined,
      approvalState: body.approvalState as "not_required" | "pending" | undefined,
      dependsOn: body.dependsOn as string[] | undefined,
      dueAt: body.dueAt as string | undefined,
      nextStep: body.nextStep as string | undefined,
      tags: body.tags as string[] | undefined,
      sessionId: body.sessionId as string | undefined,
      isRecurring: body.isRecurring as boolean | undefined,
      recurrenceRule: body.recurrenceRule as string | undefined,
      nextDueAt: body.nextDueAt as string | undefined,
    });

    return NextResponse.json({ data: task, testMode: ctx.isTestMode, persisted: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task create failed" },
      { status: 500 },
    );
  }
}
