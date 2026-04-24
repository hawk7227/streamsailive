/**
 * GET    /api/streams/tasks/[id]                   — task + history
 * PATCH  /api/streams/tasks/[id]                   — update status/priority/nextStep
 * DELETE /api/streams/tasks/[id]                   — cancel task
 *
 * POST   /api/streams/tasks/[id]?action=assign     — assign owner
 * POST   /api/streams/tasks/[id]?action=block      — block with reason
 * POST   /api/streams/tasks/[id]?action=unblock    — unblock
 * POST   /api/streams/tasks/[id]?action=approve    — approve
 * POST   /api/streams/tasks/[id]?action=reject     — reject with reason
 * POST   /api/streams/tasks/[id]?action=dep_add    — add dependency
 * POST   /api/streams/tasks/[id]?action=dep_remove — remove dependency
 * POST   /api/streams/tasks/[id]?action=link_artifact — link artifact
 * POST   /api/streams/tasks/[id]?action=link_proof    — link proof record
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import {
  getTask,
  updateTaskStatus,
  assignTask,
  blockTask,
  unblockTask,
  approveTask,
  rejectTask,
  addDependency,
  removeDependency,
  linkArtifact,
  linkProof,
} from "@/lib/streams/tasks";
import type { TaskStatus, TaskOwnerType } from "@/lib/streams/tasks";

export const maxDuration = 15;

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await getTask(admin, id, workspaceId);

  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ data: task });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Status transition goes through updateTaskStatus (validates deps)
  if (body.status) {
    try {
      const task = await updateTaskStatus(
        admin, id, workspaceId,
        body.status as TaskStatus,
        { actorType: "user", actorUserId: user.id, note: body.note as string | undefined }
      );
      return NextResponse.json({ data: task });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Status update failed" },
        { status: 400 }
      );
    }
  }

  // Other field updates — title, description, priority, nextStep, dueAt, tags
  const allowed = ["title", "description", "priority", "next_step", "due_at", "tags",
                   "nextStep", "dueAt", "is_recurring", "recurrence_rule", "next_due_at"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (body[key] !== undefined) {
      // camelCase → snake_case
      const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      updates[snake] = body[key];
    }
  }

  const { data, error } = await admin
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await updateTaskStatus(admin, id, workspaceId, "cancelled", {
    actorType: "user", actorUserId: user.id, note: "Cancelled via DELETE"
  });

  return NextResponse.json({ data: task });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch { /* empty body is fine for some actions */ }

  try {
    switch (action) {

      case "assign": {
        const ownerType = body.ownerType as TaskOwnerType;
        if (!ownerType) return NextResponse.json({ error: "ownerType required" }, { status: 400 });
        const task = await assignTask(admin, id, workspaceId, ownerType, {
          ownerUserId: body.ownerUserId as string | undefined,
          actorUserId: user.id,
          sessionId:   body.sessionId as string | undefined,
        });
        return NextResponse.json({ data: task });
      }

      case "block": {
        const reason = body.reason as string;
        if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 });
        const task = await blockTask(admin, id, workspaceId, reason, {
          actorUserId: user.id,
          sessionId:   body.sessionId as string | undefined,
        });
        return NextResponse.json({ data: task });
      }

      case "unblock": {
        const task = await unblockTask(admin, id, workspaceId, {
          actorUserId: user.id,
          note:        body.note as string | undefined,
          sessionId:   body.sessionId as string | undefined,
        });
        return NextResponse.json({ data: task });
      }

      case "approve": {
        const task = await approveTask(admin, id, workspaceId, user.id, {
          sessionId: body.sessionId as string | undefined,
        });
        return NextResponse.json({ data: task });
      }

      case "reject": {
        const reason = body.reason as string;
        if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 });
        const task = await rejectTask(admin, id, workspaceId, user.id, reason, {
          sessionId: body.sessionId as string | undefined,
        });
        return NextResponse.json({ data: task });
      }

      case "dep_add": {
        const depId = body.taskId as string;
        if (!depId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
        await addDependency(admin, id, workspaceId, depId, {
          actorUserId: user.id,
          sessionId:   body.sessionId as string | undefined,
        });
        return NextResponse.json({ added: depId });
      }

      case "dep_remove": {
        const depId = body.taskId as string;
        if (!depId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
        await removeDependency(admin, id, workspaceId, depId, {
          actorUserId: user.id,
          sessionId:   body.sessionId as string | undefined,
        });
        return NextResponse.json({ removed: depId });
      }

      case "link_artifact": {
        const artifactId = body.artifactId as string;
        if (!artifactId) return NextResponse.json({ error: "artifactId required" }, { status: 400 });
        const role = (body.role as "output" | "input" | "context") ?? "output";
        await linkArtifact(admin, id, artifactId, workspaceId, user.id, role);
        return NextResponse.json({ linked: artifactId });
      }

      case "link_proof": {
        const proofId = body.proofRecordId as string;
        if (!proofId) return NextResponse.json({ error: "proofRecordId required" }, { status: 400 });
        await linkProof(admin, id, proofId, workspaceId);
        return NextResponse.json({ linked: proofId });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action '${action}'. Valid: assign|block|unblock|approve|reject|dep_add|dep_remove|link_artifact|link_proof` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
