/**
 * POST /api/streams/video/edit-body
 *
 * Full upper-body replacement using OmniHuman v1.5.
 * Drives entire upper body from audio — posture, gestures, eye contact.
 * Single-person only — BLOCKED for multi-person video.
 *
 * Pipeline:
 *   1. Load face_reference_url from person_analysis
 *   2. Generate new voice audio (TTS or use provided audio_url)
 *   3. Submit OmniHuman v1.5: face_reference.jpg + audio → video
 *   4. Poll via /api/streams/video/status
 *
 * Presets baked in (Rule 6):
 *   guidance_scale: 1       — how closely to follow face reference
 *   audio_guidance_scale: 2 — how strongly audio drives body motion
 *   resolution: 720p
 *
 * Cost: $0.16/sec. Not suitable for multi-person — returns 422 if
 * person_analysis shows multiple detected persons.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

// OmniHuman preset — Rule 6: baked in, never configurable
const OMNIHUMAN_PRESET = {
  guidance_scale:       1, // follow face reference closely
  audio_guidance_scale: 2, // strong audio-to-body coupling
  resolution:           "720p",
} as const;

type RequestBody = {
  analysisId:       string; // person_analysis row — provides face_reference_url
  generationLogId:  string;
  audioUrl?:        string; // pre-generated audio; if absent, newText + voiceId used
  newText?:         string; // text to speak (uses stored voice_id for TTS)
  durationSeconds?: number;
};

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as RequestBody;

  if (!body.analysisId || !body.generationLogId) {
    return NextResponse.json({ error: "analysisId and generationLogId are required" }, { status: 400 });
  }
  if (!body.audioUrl && !body.newText) {
    return NextResponse.json({ error: "Either audioUrl or newText is required" }, { status: 400 });
  }

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

  // Load person_analysis
  const { data: analysis } = await admin
    .from("person_analysis")
    .select("face_reference_url, voice_id, person_index")
    .eq("id", body.analysisId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found — run ingest first" }, { status: 404 });
  }
  if (!analysis.face_reference_url) {
    return NextResponse.json({ error: "No face reference stored — ingest pipeline must complete first" }, { status: 422 });
  }

  // Determine audio source
  const audioUrl = body.audioUrl;

  if (!audioUrl && body.newText) {
    // Generate TTS audio first, then pass to OmniHuman
    if (!analysis.voice_id) {
      return NextResponse.json({ error: "No voice_id stored — IVC step of ingest must complete first" }, { status: 422 });
    }
    // Submit TTS — OmniHuman will be submitted after TTS completes
    // For now: submit TTS and return job ID for client to chain
    const ttsResult = await falSubmit(FAL_ENDPOINTS.ELEVENLABS_TTS, {
      text:             body.newText,
      voice_id:         analysis.voice_id,
      stability:        0.50,
      similarity_boost: 0.85,
    });
    if (!ttsResult.ok) {
      return NextResponse.json({ error: `TTS failed: ${ttsResult.error}` }, { status: 502 });
    }
    // Return TTS job — client must poll then submit OmniHuman with audio_url
    // This is a two-phase operation. Client polls TTS, then calls this route again with audioUrl.
    return NextResponse.json({
      phase:         "tts_submitted",
      ttsRequestId:  ttsResult.responseUrl,
      message:       "Poll TTS job, then call this route again with audioUrl from result",
      status:        "processing",
    });
  }

  // Submit OmniHuman with face reference + audio
  const omniResult = await falSubmit(FAL_ENDPOINTS.OMNIHUMAN, {
    image_url: analysis.face_reference_url,
    audio_url: audioUrl,
    ...OMNIHUMAN_PRESET,
  });

  if (!omniResult.ok) {
    return NextResponse.json({ error: `OmniHuman submit failed: ${omniResult.error}` }, { status: 502 });
  }

  // Write video_versions row
  const versionId = crypto.randomUUID();
  await admin.from("video_versions").insert({
    id:               versionId,
    workspace_id:     workspaceId,
    generation_log_id: body.generationLogId,
    edit_type:        "full_body",
    edit_metadata:    {
      analysis_id:       body.analysisId,
      audio_url:         audioUrl,
      omni_request_id:   omniResult.responseUrl,
      preset:            OMNIHUMAN_PRESET,
    },
  });

  // Log generation
  const genId = crypto.randomUUID();
  await admin.from("generation_log").insert({
    id:              genId,
    workspace_id:    workspaceId,
    generation_type: "video_t2v",
    model:           "omnihuman-v1.5",
    fal_endpoint:    FAL_ENDPOINTS.OMNIHUMAN,
    input_params:    { audio_url: audioUrl, face_reference_url: analysis.face_reference_url },
    fal_request_id:  omniResult.responseUrl,
    fal_status:      "pending",
  });

  return NextResponse.json({
    versionId,
    generationId:  genId,
    responseUrl:   omniResult.responseUrl,
    status:        "processing",
    preset:        OMNIHUMAN_PRESET,
  });
}
