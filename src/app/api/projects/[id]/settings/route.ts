/**
 * GET  /api/projects/[id]/settings  — get project settings
 * PUT  /api/projects/[id]/settings  — update project settings
 *
 * Auth: session cookie → user → workspace. Project must belong to user's workspace.
 * On update, startup context is automatically invalidated by DB trigger.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { getProjectSettings, updateProjectSettings, getProjectById } from "@/lib/project-context";
import { createAuditRecord } from "@/lib/audit";
import type { UpdateProjectSettingsInput } from "@/lib/project-context";

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

  const [projectResult, settingsResult] = await Promise.all([
    getProjectById(projectId),
    getProjectSettings(projectId),
  ]);

  if (projectResult.error) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (projectResult.data.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: settingsResult.data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { user, workspaceId } = await resolveWorkspace();
  if (!workspaceId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: UpdateProjectSettingsInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Verify ownership
  const project = await getProjectById(projectId);
  if (project.error || project.data.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await updateProjectSettings(projectId, body);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  await createAuditRecord({
    workspace_id: workspaceId,
    project_id: projectId,
    event_type: "project_settings.updated",
    event_category: "system",
    actor: `user:${user.id}`,
    subject_type: "project_settings",
    subject_ref: projectId,
    summary: `Project settings updated for "${project.data.name}"`,
    detail: { fields: Object.keys(body), projectId },
    outcome: "success",
  });

  return NextResponse.json({ data: result.data });
}
