/**
 * GET    /api/streams/memory/facts?projectId=xxx  — list pinned facts
 * POST   /api/streams/memory/facts                 — pin or update a fact
 * DELETE /api/streams/memory/facts?projectId=x&key=y — remove a fact
 *
 * Pinned facts are short key=value pairs loaded at every session start.
 * Examples: repo, branch, vercel_project, last_green_commit, tech_stack
 *
 * POST body: {
 *   projectId: string
 *   factKey: string
 *   factValue: string
 *   isSensitive?: boolean
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
    .from("pinned_project_facts")
    .select("fact_key, fact_value, is_sensitive, created_at, updated_at")
    .eq("workspace_id", workspaceId);

  const { data, error } = projectId
    ? await query.eq("project_id", projectId)
    : await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask sensitive values
  const masked = (data ?? []).map((f: Record<string, unknown>) => ({
    ...f,
    fact_value: f.is_sensitive ? "[hidden]" : f.fact_value,
  }));

  return NextResponse.json({ data: masked });
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

  const { projectId, factKey, factValue, isSensitive } = body;

  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!factKey || typeof factKey !== "string") {
    return NextResponse.json({ error: "factKey is required" }, { status: 400 });
  }
  if (factValue === undefined || factValue === null) {
    return NextResponse.json({ error: "factValue is required" }, { status: 400 });
  }

  // Upsert on (project_id, fact_key)
  const { data, error } = await admin
    .from("pinned_project_facts")
    .upsert({
      workspace_id: workspaceId,
      project_id:   projectId,
      fact_key:     factKey,
      fact_value:   String(factValue),
      is_sensitive: isSensitive ?? false,
      created_by:   user.id,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "project_id,fact_key" })
    .select("fact_key, fact_value, is_sensitive")
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
  const projectId = searchParams.get("projectId");
  const factKey   = searchParams.get("key");

  if (!projectId || !factKey) {
    return NextResponse.json({ error: "projectId and key are required" }, { status: 400 });
  }

  const { error } = await admin
    .from("pinned_project_facts")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("fact_key", factKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: factKey });
}
