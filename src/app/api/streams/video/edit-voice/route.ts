/**
 * POST /api/streams/video/edit-voice
 *
 * Replace a word or phrase in a video's voice track.
 *
 * Correct pipeline (from person_editing_pipeline_audit):
 *   1. TTS v3 with stored voice_id → new_segment.mp3
 *   2. Duration delta check (new vs original segment length)
 *   3. Trim segment to ≤15s — REQUIRED before Sync Lipsync v2
 *   4. Sync Lipsync v2 — redraws mouth region to match new audio
 *   5. fal-ai/ffmpeg-api/compose — splice back at exact timestamp
 *      (NOT merge-videos — compose is for timestamp-based splicing)
 *   6. Update video_versions row
 *
 * Critical: compose ≠ merge-videos
 *   merge-videos = concat full clips end-to-end (stitch feature only)
 *   compose      = insert segment at timestamp (word edit)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

type RequestBody = {
  generationLogId: string;   // which video to edit
  analysisId:      string;   // person_analysis row (for voice_id)
  originalText:    string;   // word/phrase being replaced
  newText:         string;   // replacement text
  startMs:         number;   // from Scribe v2 timestamp
  endMs:           number;   // from Scribe v2 timestamp
  videoUrl:        string;   // current video URL
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  // Validate required fields
  const required = ["generationLogId","analysisId","originalText","newText","startMs","endMs","videoUrl"] as const;
  for (const field of required) {
    if (!body[field] && body[field] !== 0) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Segment must be ≤15s — Sync Lipsync v2 hard limit
  const segmentMs = body.endMs - body.startMs;
  if (segmentMs > 15_000) {
    return NextResponse.json({
      error: "Segment exceeds 15s Sync Lipsync v2 limit. Split into shorter segments first.",
    }, { status: 400 });
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

  // Load voice_id from person_analysis
  const { data: analysis } = await admin
    .from("person_analysis")
    .select("voice_id")
    .eq("id", body.analysisId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!analysis?.voice_id) {
    return NextResponse.json({
      error: "No voice_id found for this video. Run ingest pipeline first.",
    }, { status: 422 });
  }

  // Step 1: TTS v3 with stored voice_id
  const ttsResult = await falSubmit(FAL_ENDPOINTS.ELEVENLABS_TTS, {
    text:             body.newText,
    voice_id:         analysis.voice_id,
    stability:        0.50,
    similarity_boost: 0.85,
    style:            0.00,
    speed:            1.00,
  });

  if (!ttsResult.ok) {
    return NextResponse.json({ error: `TTS failed: ${ttsResult.error}` }, { status: 502 });
  }

  // Steps 2–5 will be completed after polling ttsResult
  // For now: return the TTS job ID — the status poller handles lipsync + compose
  const versionId = crypto.randomUUID();
  await admin.from("video_versions").insert({
    id:               versionId,
    workspace_id:     workspaceId,
    generation_log_id: body.generationLogId,
    edit_type:        "voice_word",
    edit_metadata:    {
      original_text: body.originalText,
      new_text:      body.newText,
      start_ms:      body.startMs,
      end_ms:        body.endMs,
      segment_ms:    segmentMs,
      tts_request_id: ttsResult.responseUrl,
      voice_id:      analysis.voice_id,
      // Next steps (lipsync + compose) run in status poller after TTS completes
      pending_steps: ["lipsync","compose"],
    },
  });

  return NextResponse.json({
    versionId,
    ttsRequestId: ttsResult.responseUrl,
    status:       "processing",
    segmentMs,
    message:      "TTS submitted. Poll /api/streams/video/edit-voice/status for lipsync + compose completion.",
  });
}
