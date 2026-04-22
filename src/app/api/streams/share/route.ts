/**
 * POST /api/streams/share  — create a share link
 * GET  /api/streams/share  — list workspace share links
 * Resolves slug → generation_log output_url for the viewer.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export const maxDuration = 30;

function generateSlug(): string {
  // 6-char base-36 slug — 2.17 billion combinations
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as {
    generationLogId?: string;
    title?:           string;
    isPublic?:        boolean;
    expiresInDays?:   number;
  };

  if (!body.generationLogId) {
    return NextResponse.json({ error: "generationLogId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // Verify the generation_log row belongs to this workspace
  const { data: logRow } = await admin
    .from("generation_log")
    .select("id, output_url, fal_status")
    .eq("id", body.generationLogId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!logRow) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }
  if (logRow.fal_status !== "done" || !logRow.output_url) {
    return NextResponse.json({ error: "Generation not complete — cannot share yet" }, { status: 422 });
  }

  // Generate unique slug (retry on collision — astronomically rare)
  let slug = generateSlug();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await admin.from("share_links").select("id").eq("slug", slug).single();
    if (!existing) break;
    slug = generateSlug();
    attempts++;
  }

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 86400_000).toISOString()
    : null;

  const { data: link, error: insertError } = await admin
    .from("share_links")
    .insert({
      slug,
      workspace_id:      workspaceId,
      generation_log_id: body.generationLogId,
      title:             body.title ?? null,
      is_public:         body.isPublic ?? true,
      expires_at:        expiresAt,
    })
    .select("id, slug")
    .single();

  if (insertError || !link) {
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }

  return NextResponse.json({
    slug:     link.slug,
    shareUrl: `/s/${link.slug}`,
    expiresAt,
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const { data } = await admin
    .from("share_links")
    .select("id, slug, title, is_public, expires_at, view_count, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ links: data ?? [] });
}
