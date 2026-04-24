/**
 * GET    /api/streams/artifacts/[id]  — get artifact + current version
 * PATCH  /api/streams/artifacts/[id]  — update artifact metadata or state
 * DELETE /api/streams/artifacts/[id]  — archive artifact (soft delete)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { getArtifact } from "@/lib/streams/artifacts";

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
  const artifact = await getArtifact(admin, id, workspaceId);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return NextResponse.json({ data: artifact });
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

  // Only allow updating safe fields — not id, workspace_id, project_id
  const allowed = ["name", "description", "state", "tags", "preview_url"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (body[camel] !== undefined) updates[key] = body[camel];
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const VALID_STATES = ["draft", "stable", "deprecated", "archived"];
  if (updates.state && !VALID_STATES.includes(updates.state as string)) {
    return NextResponse.json(
      { error: `state must be one of: ${VALID_STATES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("artifacts")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

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

  // Soft delete — set state to archived
  const { error } = await admin
    .from("artifacts")
    .update({ state: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archived: id });
}
