/**
 * src/app/api/artifacts/route.ts
 *
 * GET /api/artifacts
 *
 * Returns generated media artifacts for a conversation or workspace.
 * Used by the artifact browse panel and the inline ArtifactCard component.
 *
 * Auth: session cookie → user → workspace via getCurrentWorkspaceSelection.
 * The workspace_id is always resolved server-side — never trusted from the client.
 *
 * Query params:
 *   conversationId  string   Filter to a specific conversation. Omit for all.
 *   type            string   Coarse filter: 'image' | 'video' | 'audio'
 *   mediaType       string   Fine filter: 'image' | 'video' | 'i2v' | 'song' | 'voice' | 'song_stem'
 *   limit           number   Max rows returned (default: 20, max: 50)
 *
 * Response:
 *   200 { data: ArtifactRow[], count: number }
 *   400 { error: string }     — invalid params
 *   401 { error: string }     — not authenticated
 *   500 { error: string }     — server error
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { toErrorMessage } from "@/lib/utils/error";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArtifactRow = {
  id: string;
  generationId: string;
  workspaceId: string;
  conversationId: string | null;
  type: string;
  mediaType: string | null;
  storageUrl: string;
  mimeType: string;
  title: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const VALID_TYPES = new Set(["image", "video", "audio"]);
const VALID_MEDIA_TYPES = new Set(["image", "video", "i2v", "song", "song_stem", "voice"]);

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;

  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = selection.current.workspace.id;
  } catch (err: unknown) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }

  // ── Params ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const conversationId = searchParams.get("conversationId");
  const typeFilter = searchParams.get("type");
  const mediaTypeFilter = searchParams.get("mediaType");
  const limitParam = searchParams.get("limit");

  // Validate type filter
  if (typeFilter !== null && !VALID_TYPES.has(typeFilter)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Validate mediaType filter
  if (mediaTypeFilter !== null && !VALID_MEDIA_TYPES.has(mediaTypeFilter)) {
    return NextResponse.json(
      { error: `Invalid mediaType. Must be one of: ${[...VALID_MEDIA_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Parse and clamp limit
  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  // ── Query ─────────────────────────────────────────────────────────────────
  // workspace_id is always server-resolved — never from query params.
  // This is the primary RLS enforcement for this route.
  let query = admin
    .from("artifacts")
    .select(
      "id, generation_id, workspace_id, conversation_id, type, media_type, " +
      "storage_url, mime_type, title, thumbnail_url, width, height, " +
      "duration_seconds, metadata, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (conversationId) {
    query = query.eq("conversation_id", conversationId);
  }

  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }

  if (mediaTypeFilter) {
    query = query.eq("media_type", mediaTypeFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "ARTIFACTS_QUERY_FAILED",
        workspaceId,
        reason: error.message,
      }),
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Shape ─────────────────────────────────────────────────────────────────
  // Map snake_case DB columns to camelCase for the client.
  // Cast data array — the artifacts table is not in Supabase generated types.
  // All fields are validated against the DB schema in the migrations.
  const rawRows = (data ?? []) as unknown as Record<string, unknown>[];
  const rows: ArtifactRow[] = rawRows.map((row) => ({
    id: row.id as string,
    generationId: row.generation_id as string,
    workspaceId: row.workspace_id as string,
    conversationId: (row.conversation_id as string | null) ?? null,
    type: row.type as string,
    mediaType: (row.media_type as string | null) ?? null,
    storageUrl: row.storage_url as string,
    mimeType: row.mime_type as string,
    title: (row.title as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    durationSeconds: (row.duration_seconds as number | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }));

  return NextResponse.json({ data: rows, count: rows.length });
}
