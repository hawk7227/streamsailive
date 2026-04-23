/**
 * GET  /api/projects/[id]/bindings  — get project bindings (GitHub/Vercel/Supabase)
 * PUT  /api/projects/[id]/bindings  — update project bindings
 *
 * Auth: session cookie → user → workspace. Project must belong to user's workspace.
 *
 * PUT body: UpdateProjectBindingsInput (any subset of binding fields)
 * On update, the startup context is automatically invalidated by DB trigger.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { getProjectBindings, updateProjectBindings } from "@/lib/project-context";
import { createAuditRecord } from "@/lib/audit";
import type { UpdateProjectBindingsInput } from "@/lib/project-context";

async function resolveWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, workspaceId: null };
  const admin = createAdminClient();
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: selection.current.workspace.id };
  } catch {
    return { user, workspaceId: null };
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { workspaceId } = await resolveWorkspace();
  if (!workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getProjectBindings(projectId);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // Verify ownership
  if (result.data?.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: result.data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { user, workspaceId } = await resolveWorkspace();
  if (!workspaceId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: UpdateProjectBindingsInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Verify ownership before update
  const existing = await getProjectBindings(projectId);
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (existing.data?.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await updateProjectBindings(projectId, body);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  await createAuditRecord({
    workspace_id: workspaceId,
    project_id: projectId,
    event_type: "project_bindings.updated",
    event_category: "system",
    actor: `user:${user.id}`,
    subject_type: "project_bindings",
    subject_ref: projectId,
    summary: `Project bindings updated for project ${projectId}`,
    detail: { fields: Object.keys(body), projectId },
    outcome: "success",
  });

  return NextResponse.json({ data: result.data });
}
