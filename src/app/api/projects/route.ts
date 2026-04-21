/**
 * src/app/api/projects/route.ts
 *
 * GET  /api/projects        — list all projects for the current workspace
 * POST /api/projects        — create a new project
 *
 * Auth: session cookie → user → workspace via getCurrentWorkspaceSelection.
 * workspace_id always server-resolved — never from query params.
 *
 * GET response:
 *   200 { data: ProjectRow[] }
 *
 * POST body:   { name: string, description?: string }
 * POST response:
 *   201 { data: ProjectRow }
 *   400 { error: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { toErrorMessage } from "@/lib/utils/error";

export type ProjectRow = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

async function resolveWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, workspaceId: null, admin: null };
  const admin = createAdminClient();
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: selection.current.workspace.id, admin };
  } catch {
    return { user, workspaceId: null, admin };
  }
}

function mapRow(row: Record<string, unknown>): ProjectRow {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function GET(): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveWorkspace();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspaceId || !admin) return NextResponse.json({ error: "Workspace not found" }, { status: 500 });

  const { data, error } = await admin
    .from("projects")
    .select("id, workspace_id, name, description, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRow);
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveWorkspace();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspaceId || !admin) return NextResponse.json({ error: "Workspace not found" }, { status: 500 });

  let body: { name?: string; description?: string };
  try {
    body = await request.json() as { name?: string; description?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "name must be 80 characters or fewer" }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name,
      description: body.description?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select("id, workspace_id, name, description, created_at, updated_at")
    .single();

  if (error) {
    console.error(JSON.stringify({ level: "error", event: "PROJECT_CREATE_FAILED", reason: error.message }));
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }

  const row = mapRow(data as unknown as Record<string, unknown>);
  return NextResponse.json({ data: row }, { status: 201 });
}
