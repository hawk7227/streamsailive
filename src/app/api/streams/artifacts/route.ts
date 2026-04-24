/**
 * GET  /api/streams/artifacts?projectId=&type=&state=&limit=
 * POST /api/streams/artifacts
 *
 * GET — list artifacts for the current workspace/project.
 * POST — create a new artifact with its first version atomically.
 *
 * POST body: {
 *   projectId?:       string
 *   name:             string
 *   slug:             string        — url-safe, unique within project
 *   description?:     string
 *   artifactType:     ArtifactType
 *   origin?:          'generated' | 'edited' | 'imported'
 *   tags?:            string[]
 *   sessionId?:       string
 *   generationLogId?: string
 *   contentText?:     string        — inline content (code, doc, html, etc.)
 *   contentUrl?:      string        — asset URL (image, video)
 *   contentType?:     string        — MIME type
 *   contentSizeBytes?: number
 *   previewUrl?:      string
 *   changeSummary?:   string
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { createArtifact, listArtifacts } from "@/lib/streams/artifacts";
import type { ArtifactType, ArtifactState } from "@/lib/streams/artifacts";

export const maxDuration = 30;

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

export async function GET(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const data = await listArtifacts(admin, workspaceId, {
    projectId:    searchParams.get("projectId") ?? undefined,
    artifactType: searchParams.get("type") as ArtifactType | undefined,
    state:        searchParams.get("state") as ArtifactState | undefined,
    limit:        searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });

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

  const { name, slug, artifactType } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!artifactType || typeof artifactType !== "string") {
    return NextResponse.json({ error: "artifactType is required" }, { status: 400 });
  }

  const VALID_TYPES = ["code","doc","image","video","svg","react","html","schema","prompt_pack"];
  if (!VALID_TYPES.includes(artifactType)) {
    return NextResponse.json(
      { error: `artifactType must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const artifact = await createArtifact(admin, user.id, {
      workspaceId,
      projectId:        body.projectId as string | undefined,
      name,
      slug,
      description:      body.description as string | undefined,
      artifactType:     artifactType as ArtifactType,
      origin:           (body.origin as "generated" | "edited" | "imported") ?? "generated",
      tags:             body.tags as string[] | undefined,
      sessionId:        body.sessionId as string | undefined,
      generationLogId:  body.generationLogId as string | undefined,
      contentText:      body.contentText as string | undefined,
      contentUrl:       body.contentUrl as string | undefined,
      contentType:      body.contentType as string | undefined,
      contentSizeBytes: body.contentSizeBytes as number | undefined,
      previewUrl:       body.previewUrl as string | undefined,
      changeSummary:    body.changeSummary as string | undefined,
    });

    return NextResponse.json({ data: artifact }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Artifact create failed";
    // Duplicate slug returns a clear error
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: `Slug '${slug}' already exists in this project` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
