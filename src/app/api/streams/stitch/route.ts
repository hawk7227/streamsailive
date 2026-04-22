/**
 * POST /api/streams/stitch
 *
 * Stitches an ordered list of video clips into one output via
 * fal-ai/ffmpeg-api/merge-videos.
 *
 * Rule: merge-videos is for END-TO-END concatenation only (stitch).
 *       compose is for TIMESTAMP-BASED splicing (word edits).
 *       These are never interchangeable.
 *
 * Input: { clips: string[] }  — ordered array of output_url values
 *        from generation_log rows belonging to this workspace.
 * Returns: { generationId, responseUrl, status: "queued" }
 * Client polls /api/streams/video/status as usual.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as { clips?: unknown[] };

  if (!Array.isArray(body.clips) || body.clips.length < 2) {
    return NextResponse.json({ error: "clips must be an array of at least 2 URLs" }, { status: 400 });
  }
  if (body.clips.length > 20) {
    return NextResponse.json({ error: "clips cannot exceed 20 per stitch" }, { status: 400 });
  }
  if (!body.clips.every(c => typeof c === "string" && c.startsWith("http"))) {
    return NextResponse.json({ error: "all clips must be valid HTTP URLs" }, { status: 400 });
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

  // fal-ai/ffmpeg-api/merge-videos — concatenate clips end-to-end
  // Input: { video_urls: string[] }
  const submitResult = await falSubmit(FAL_ENDPOINTS.FFMPEG_MERGE, {
    video_urls: body.clips as string[],
  });

  if (!submitResult.ok) {
    return NextResponse.json({ error: submitResult.error }, { status: 502 });
  }

  const generationId = crypto.randomUUID();
  await admin.from("generation_log").insert({
    id:              generationId,
    workspace_id:    workspaceId,
    generation_type: "video_stitch",
    model:           "ffmpeg-merge",
    fal_endpoint:    FAL_ENDPOINTS.FFMPEG_MERGE,
    input_params:    { clips: body.clips, count: (body.clips as string[]).length },
    fal_request_id:  submitResult.responseUrl,
    fal_status:      "pending",
  });

  return NextResponse.json({
    generationId,
    responseUrl: submitResult.responseUrl,
    status:      "queued",
    clipCount:   (body.clips as string[]).length,
  });
}
