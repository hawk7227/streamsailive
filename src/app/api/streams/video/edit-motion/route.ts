/**
 * POST /api/streams/video/edit-motion
 *
 * Replace a shot's motion by regenerating it from its stored first frame.
 *
 * Correct pipeline:
 *   1. Load stored firstFrameUrl from video_versions or generation_log
 *   2. For STREAMS-generated videos: use stored appearance_description as prompt
 *      (NOT image_url — Kling motion-control takes text description only)
 *   3. Kling v3 I2V: firstFrameUrl + new motion prompt → new shot clip
 *   4. fal-ai/ffmpeg-api/compose — replace shot at start/end timestamps
 *   5. Write video_versions row
 *
 * Kling motion-control vs I2V:
 *   motion-control: prompt=CHARACTER APPEARANCE TEXT + video_url=reference motion
 *   I2V:            start_image_url=first frame + prompt=motion description
 *   These are different use cases. This route uses I2V for shot replacement.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

type RequestBody = {
  generationLogId: string;
  firstFrameUrl:   string;   // stored at generation time
  newPrompt:       string;   // new motion description
  startMs:         number;
  endMs:           number;
  duration?:       number;   // seconds — derived from startMs/endMs if not provided
  aspectRatio?:    string;
  videoUrl:        string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  if (!body.firstFrameUrl || !body.newPrompt || !body.videoUrl) {
    return NextResponse.json({ error: "firstFrameUrl, newPrompt, and videoUrl are required" }, { status: 400 });
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

  const durationSec = body.duration ?? Math.round((body.endMs - body.startMs) / 1000);
  const clampedDuration = String(Math.max(3, Math.min(15, durationSec)));

  // Kling v3 I2V — prompt describes motion, start_image_url is first frame
  const i2vResult = await falSubmit(FAL_ENDPOINTS.KLING_V3_I2V, {
    start_image_url: body.firstFrameUrl,
    prompt:          body.newPrompt,
    duration:        clampedDuration,
    aspect_ratio:    body.aspectRatio ?? "16:9",
    generate_audio:  true,
  });

  if (!i2vResult.ok) {
    return NextResponse.json({ error: `I2V submit failed: ${i2vResult.error}` }, { status: 502 });
  }

  const versionId = crypto.randomUUID();
  await admin.from("video_versions").insert({
    id:               versionId,
    workspace_id:     workspaceId,
    generation_log_id: body.generationLogId,
    edit_type:        "motion_style",
    edit_metadata:    {
      new_prompt:     body.newPrompt,
      start_ms:       body.startMs,
      end_ms:         body.endMs,
      duration_sec:   clampedDuration,
      i2v_request_id: i2vResult.responseUrl,
      first_frame_url: body.firstFrameUrl,
      pending_steps:  ["compose"],  // compose after I2V completes
    },
  });

  return NextResponse.json({
    versionId,
    i2vRequestId: i2vResult.responseUrl,
    status:       "processing",
    message:      "Shot regeneration submitted. Poll for completion then compose will splice it back.",
  });
}
