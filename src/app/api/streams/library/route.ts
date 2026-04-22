/**
 * GET /api/streams/library
 *
 * Returns all generation_log rows for the current workspace.
 * Used by ChatTab sidebar "Library" view and GenerateTab grid history.
 * Ordered by created_at DESC. Limit 50 per page.
 *
 * Query params:
 *   ?type=video|image|voice|music|all  (default: all)
 *   ?status=done|failed|pending|all    (default: done)
 *   ?limit=50                          (max: 100)
 *   ?before=<ISO timestamp>            (cursor-based pagination)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const type   = searchParams.get("type")   ?? "all";
  const status = searchParams.get("status") ?? "done";
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const before = searchParams.get("before");

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

  let query = admin
    .from("generation_log")
    .select("id, generation_type, model, fal_endpoint, input_params, fal_status, output_url, cost_usd, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type !== "all")   query = query.eq("generation_type", type);
  if (status !== "all") query = query.eq("fal_status", status);
  if (before)           query = query.lt("created_at", before);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }

  return NextResponse.json({
    items:    data ?? [],
    count:    data?.length ?? 0,
    hasMore:  (data?.length ?? 0) === limit,
    cursor:   data?.at(-1)?.created_at ?? null,
  });
}
