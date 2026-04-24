/**
 * GET  /api/streams/tasks?projectId=&status=&priority=&ownerType=&limit=
 * POST /api/streams/tasks
 *
 * GET — list tasks for the current workspace, filtered by query params.
 * POST — create a new task. Status starts at 'backlog'.
 *
 * POST body: {
 *   projectId?:      string
 *   title:           string
 *   description?:    string
 *   priority?:       TaskPriority
 *   ownerType?:      'user' | 'ai' | 'system'
 *   ownerUserId?:    string
 *   approvalState?:  TaskApprovalState
 *   dependsOn?:      string[]
 *   dueAt?:          string        — ISO 8601
 *   nextStep?:       string
 *   tags?:           string[]
 *   sessionId?:      string
 *   isRecurring?:    boolean
 *   recurrenceRule?: string        — rrule string
 *   nextDueAt?:      string        — ISO 8601
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { createTask, listTasks } from "@/lib/streams/tasks";
import type { TaskStatus, TaskPriority, TaskOwnerType } from "@/lib/streams/tasks";

export const maxDuration = 30;

async function resolveUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, workspaceId: null, admin: null };
  const admin = createAdminClient();
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: sel.current.workspace.id, admin };
  } catch {
    return { user: null, workspaceId: null, admin: null };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const data = await listTasks(admin, workspaceId, {
    projectId:   searchParams.get("projectId") ?? undefined,
    status:      searchParams.get("status") as TaskStatus | undefined,
    priority:    searchParams.get("priority") as TaskPriority | undefined,
    ownerType:   searchParams.get("ownerType") as TaskOwnerType | undefined,
    ownerUserId: searchParams.get("ownerUserId") ?? undefined,
    limit:       searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });

  return NextResponse.json({ data });
}

export async function POST(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title } = body;
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const task = await createTask(admin, user.id, {
      workspaceId,
      projectId:      body.projectId as string | undefined,
      title,
      description:    body.description as string | undefined,
      priority:       body.priority as TaskPriority | undefined,
      ownerType:      body.ownerType as TaskOwnerType | undefined,
      ownerUserId:    body.ownerUserId as string | undefined,
      approvalState:  body.approvalState as "not_required" | "pending" | undefined,
      dependsOn:      body.dependsOn as string[] | undefined,
      dueAt:          body.dueAt as string | undefined,
      nextStep:       body.nextStep as string | undefined,
      tags:           body.tags as string[] | undefined,
      sessionId:      body.sessionId as string | undefined,
      isRecurring:    body.isRecurring as boolean | undefined,
      recurrenceRule: body.recurrenceRule as string | undefined,
      nextDueAt:      body.nextDueAt as string | undefined,
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Task create failed" },
      { status: 500 }
    );
  }
}
