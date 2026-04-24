/**
 * GET  /api/streams/memory/rules?projectId=xxx  — list rules
 * POST /api/streams/memory/rules                 — create rule
 * DELETE /api/streams/memory/rules?id=xxx        — deactivate rule
 *
 * Memory rules are persistent project-level rules loaded at every session start.
 * They govern how work is done on this project beyond the global build rules.
 *
 * POST body: {
 *   projectId?: string
 *   ruleText: string
 *   category?: 'code' | 'design' | 'process' | 'general'
 *   priority?: number
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export const maxDuration = 15;

async function resolveUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, workspaceId: null, admin: null };
  const admin = createAdminClient();
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: selection.current.workspace.id, admin };
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
  const projectId = searchParams.get("projectId");

  const query = admin
    .from("project_memory_rules")
    .select("id, rule_text, category, priority, is_active, created_at")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const { data, error } = projectId
    ? await query.eq("project_id", projectId)
    : await query.is("project_id", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  const { ruleText, projectId, category, priority } = body;
  if (!ruleText || typeof ruleText !== "string") {
    return NextResponse.json({ error: "ruleText is required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("project_memory_rules")
    .insert({
      workspace_id: workspaceId,
      project_id:   projectId ?? null,
      rule_text:    ruleText,
      category:     category ?? "general",
      priority:     priority ?? 0,
      is_active:    true,
      created_by:   user.id,
    })
    .select("id, rule_text, category, priority")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Soft-delete: set is_active = false
  const { error } = await admin
    .from("project_memory_rules")
    .update({ is_active: false })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: id });
}
