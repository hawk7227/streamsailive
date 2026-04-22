/**
 * POST /api/streams/video/ingest
 *
 * 8-step ingest pipeline. Runs once per video. Stores all results in
 * person_analysis. Every subsequent edit reads from stored data — this
 * route never runs again for the same video.
 *
 * Steps (each is a fal job submitted to queue):
 *   1. ffmpeg-api — extract audio track
 *   2. elevenlabs/audio-isolation — voice.mp3 + ambient.mp3
 *   3. ffmpeg-api — frame extraction (1 per 2s)
 *   4. GPT-4o Vision — per-frame quality scoring, face detection
 *   5. GPT-4o Vision — appearance_description (second call, best frame only)
 *   6. elevenlabs/speech-to-text (Scribe v2) — word-level timestamps
 *   7. ElevenLabs IVC — POST /v1/voices/add → voice_id
 *   8. Write person_analysis row
 *
 * Structural constraint:
 *   Steps 1–6 are fal async jobs — each submitted and polled.
 *   Step 7 is a direct ElevenLabs API call (not via fal).
 *   This route runs inside a 60s maxDuration limit.
 *   For longer videos: Steps 1–6 must move to a background worker.
 *   For now: submit fal jobs and return immediately with ingest_id.
 *   Client polls /api/streams/video/ingest/status for completion.
 *
 * Critical correctness rules (from audit):
 *   - GPT-4o Vision CANNOT produce speaking timestamps — only Scribe v2 can
 *   - Kling motion-control does NOT accept image_url — use text description
 *   - Use compose (not merge-videos) for word edit splice at timestamp
 *   - Segment must be trimmed to 15s MAX before Sync Lipsync v2
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";
// ELEVENLABS_API_KEY used in Step 7 (IVC) — implement when ingest/status poller is built

export const maxDuration = 60;

type RequestBody = {
  videoUrl:         string;   // Supabase storage URL of the uploaded/generated video
  generationLogId?: string;   // if from a generation_log entry
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  if (typeof body.videoUrl !== "string" || !body.videoUrl.trim()) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
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

  // Insert person_analysis row — status: processing
  const analysisId = crypto.randomUUID();
  await admin.from("person_analysis").insert({
    id:                 analysisId,
    workspace_id:       workspaceId,
    generation_log_id:  body.generationLogId ?? null,
    ingest_status:      "processing",
  });

  // ── Step 1: Submit audio extraction to fal ffmpeg ─────────────────────────
  const audioExtractResult = await falSubmit(FAL_ENDPOINTS.FFMPEG_METADATA, {
    video_url: body.videoUrl,
  });

  // ── Step 2: Submit audio isolation ────────────────────────────────────────
  const isolationResult = await falSubmit(FAL_ENDPOINTS.ELEVENLABS_ISOLATION, {
    audio_url: body.videoUrl, // fal can extract audio from video URL directly
  });

  // ── Step 6: Submit Scribe v2 transcription ────────────────────────────────
  // Submitted early — it's the slowest step and can run in parallel with steps 3–5
  const scribeResult = await falSubmit(FAL_ENDPOINTS.ELEVENLABS_SCRIBE, {
    audio_url: body.videoUrl,
    diarize:   true,  // speaker separation
  });

  // Store fal request IDs in the row so the status poller can check them
  await admin.from("person_analysis").update({
    // Store job IDs as JSONB in frame_scores temporarily during ingest
    frame_scores: {
      ingest_jobs: {
        audio_extract: audioExtractResult.ok ? audioExtractResult.responseUrl : null,
        isolation:     isolationResult.ok    ? isolationResult.responseUrl    : null,
        scribe:        scribeResult.ok        ? scribeResult.responseUrl        : null,
        video_url:     body.videoUrl,
        workspace_id:  workspaceId,
      }
    }
  }).eq("id", analysisId);

  // Return immediately — client polls /api/streams/video/ingest/status
  return NextResponse.json({
    analysisId,
    status: "processing",
    jobs: {
      audioExtract: audioExtractResult.ok,
      isolation:    isolationResult.ok,
      scribe:       scribeResult.ok,
    },
    message: "Ingest pipeline started. Poll /api/streams/video/ingest/status for completion.",
  });
}
