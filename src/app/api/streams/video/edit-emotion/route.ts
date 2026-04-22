/**
 * POST /api/streams/video/edit-emotion
 *
 * Expression/emotion change via Sync Lipsync React-1.
 * Modifies emotional delivery of existing footage — no regeneration.
 * Zero retraining. Modifies the expression and head movement only.
 *
 * Preset params (Rule 6 — baked in):
 *   Sync React-1 controls: emotion, head_mode, temperature
 *   emotion: neutral | happy | sad | angry | surprised | disgusted | fearful
 *   head_mode: 0 (still) | 1 (natural) | 2 (animated)
 *   temperature: 0.0–1.0 (expressiveness)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const VALID_EMOTIONS = ["neutral","happy","sad","angry","surprised","disgusted","fearful"] as const;
type Emotion = typeof VALID_EMOTIONS[number];

type RequestBody = {
  generationLogId: string;
  videoUrl:        string;
  emotion:         Emotion;
  headMode?:       0 | 1 | 2;   // 0=still, 1=natural, 2=animated
  temperature?:    number;       // 0.0–1.0, default 0.5
};

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as RequestBody;

  if (!body.generationLogId || !body.videoUrl || !body.emotion) {
    return NextResponse.json({ error: "generationLogId, videoUrl, and emotion are required" }, { status: 400 });
  }

  if (!VALID_EMOTIONS.includes(body.emotion)) {
    return NextResponse.json({
      error: `emotion must be one of: ${VALID_EMOTIONS.join(", ")}`,
    }, { status: 400 });
  }

  const temperature = Math.max(0, Math.min(1, body.temperature ?? 0.5));
  const headMode    = body.headMode ?? 1;

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const emotionResult = await falSubmit(FAL_ENDPOINTS.SYNC_REACT, {
    video_url:   body.videoUrl,
    emotion:     body.emotion,
    head_mode:   headMode,
    temperature,
  });

  if (!emotionResult.ok) {
    return NextResponse.json({ error: `Emotion edit failed: ${emotionResult.error}` }, { status: 502 });
  }

  const versionId = crypto.randomUUID();
  await admin.from("video_versions").insert({
    id:               versionId,
    workspace_id:     workspaceId,
    generation_log_id: body.generationLogId,
    edit_type:        "emotion",
    edit_metadata:    {
      emotion:      body.emotion,
      head_mode:    headMode,
      temperature,
      request_id:   emotionResult.responseUrl,
    },
  });

  // Log to generation_log
  const genId = crypto.randomUUID();
  await admin.from("generation_log").insert({
    id:              genId,
    workspace_id:    workspaceId,
    generation_type: "video_t2v",
    model:           "sync-react-1",
    fal_endpoint:    FAL_ENDPOINTS.SYNC_REACT,
    input_params:    { emotion: body.emotion, head_mode: headMode, temperature },
    fal_request_id:  emotionResult.responseUrl,
    fal_status:      "pending",
  });

  return NextResponse.json({
    versionId,
    generationId: genId,
    responseUrl:  emotionResult.responseUrl,
    status:       "processing",
    emotion:      body.emotion,
    headMode,
    temperature,
  });
}
