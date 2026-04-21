/**
 * src/app/api/projects/[id]/conversations/route.ts
 *
 * GET  /api/projects/[id]/conversations  — list conversation IDs in a project
 * POST /api/projects/[id]/conversations  — assign a conversation to a project
 *
 * Auth: session cookie → user → workspace. Project must belong to user's workspace.
 *
 * POST body:  { conversationId: string }
 * POST response:
 *   201 { ok: true }
 *   400 { error: string }
 *   403 { error: string }  — project not in user's workspace
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = selection.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 500 });
  }

  // Verify project belongs to user's workspace
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 403 });

  const { data, error } = await admin
    .from("project_conversations")
    .select("conversation_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    conversationId: r.conversation_id as string,
    createdAt: r.created_at as string,
  }));

  return NextResponse.json({ data: rows });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = selection.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 500 });
  }

  let body: { conversationId?: string };
  try {
    body = await request.json() as { conversationId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const conversationId = body.conversationId?.trim();
  if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 });

  // Verify project belongs to user's workspace
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 403 });

  // Upsert — idempotent if already assigned
  const { error } = await admin
    .from("project_conversations")
    .upsert({
      project_id: projectId,
      conversation_id: conversationId,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
    }, { onConflict: "project_id,conversation_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
