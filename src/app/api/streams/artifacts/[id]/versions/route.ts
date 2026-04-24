/**
 * GET  /api/streams/artifacts/[id]/versions       — list all versions
 * POST /api/streams/artifacts/[id]/versions       — add a new version
 * POST /api/streams/artifacts/[id]/versions/prove — mark current version Proven
 * POST /api/streams/artifacts/[id]/versions/reject— mark current version Rejected
 *
 * POST body (new version): {
 *   contentText?:     string
 *   contentUrl?:      string
 *   contentType?:     string
 *   contentSizeBytes?: number
 *   changeSummary?:   string
 *   origin?:          'generated' | 'edited' | 'imported'
 *   previewUrl?:      string
 *   sessionId?:       string
 *   generationLogId?: string
 * }
 *
 * POST body (prove/reject): {
 *   evidence: string   — commit hash, Vercel URL, test output, reason, etc.
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import {
  addVersion,
  listVersions,
  proveVersion,
  rejectVersion,
  getArtifact,
} from "@/lib/streams/artifacts";

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
  const versions = await listVersions(admin, id, workspaceId);

  return NextResponse.json({ data: versions });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Prove or reject the current version
  if (action === "prove" || action === "reject") {
    const evidence = body.evidence;
    if (!evidence || typeof evidence !== "string") {
      return NextResponse.json({ error: "evidence is required" }, { status: 400 });
    }

    const artifact = await getArtifact(admin, id, workspaceId);
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }
    if (!artifact.currentVersionId) {
      return NextResponse.json({ error: "Artifact has no versions" }, { status: 400 });
    }

    if (action === "prove") {
      await proveVersion(admin, artifact.currentVersionId, id, workspaceId, evidence);
      return NextResponse.json({ proved: artifact.currentVersionId });
    } else {
      await rejectVersion(admin, artifact.currentVersionId, id, workspaceId, evidence);
      return NextResponse.json({ rejected: artifact.currentVersionId });
    }
  }

  // Add a new version
  try {
    const version = await addVersion(admin, user.id, {
      artifactId:       id,
      workspaceId,
      contentText:      body.contentText as string | undefined,
      contentUrl:       body.contentUrl as string | undefined,
      contentType:      body.contentType as string | undefined,
      contentSizeBytes: body.contentSizeBytes as number | undefined,
      changeSummary:    body.changeSummary as string | undefined,
      origin:           (body.origin as "generated" | "edited" | "imported") ?? "edited",
      previewUrl:       body.previewUrl as string | undefined,
      sessionId:        body.sessionId as string | undefined,
      generationLogId:  body.generationLogId as string | undefined,
    });

    return NextResponse.json({ data: version }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Version create failed" },
      { status: 500 }
    );
  }
}
