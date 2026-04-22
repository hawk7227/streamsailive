/**
 * POST /api/streams/music/generate
 *
 * Submits a music generation job to MiniMax via fal.
 * Supports: minimax-v2.6 (default), minimax-draft, minimax-ref, elevenlabs.
 *
 * Two-prompt rule enforced at this boundary:
 *   prompt  = STYLE ONLY (genre, mood, BPM, key — 10–300 chars)
 *   lyrics  = WORDS + structure tags only
 *   Never put lyrics in prompt. Never put style in lyrics.
 *
 * Flow: validate → auth → insert generation_log → submit to fal → return { generationId, responseUrl }
 * Client polls /api/streams/video/status (same status route, same shape).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

// Provider → endpoint map (brand names mapped to fal endpoints)
const PROVIDER_ENDPOINTS: Record<string, string> = {
  "music":         FAL_ENDPOINTS.MINIMAX_V26,
  "music-draft":   FAL_ENDPOINTS.MINIMAX_DRAFT,
  "music-ref":     FAL_ENDPOINTS.MINIMAX_REF,
  "commercial":    FAL_ENDPOINTS.ELEVENLABS_MUSIC,
};

type RequestBody = {
  provider?:           string;
  prompt:              string;       // STYLE ONLY
  lyrics?:             string;       // WORDS + structure tags
  is_instrumental?:    boolean;
  lyrics_optimizer?:   boolean;      // MiniMax auto-writes lyrics from prompt
  reference_audio_url?: string;      // for cover/style-match mode
  topic?:              string;       // user's song concept — used in generation_log only
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  // Validate — enforce two-prompt rule at boundary
  if (typeof body.prompt !== "string" || body.prompt.trim().length < 10) {
    return NextResponse.json({
      error: "prompt is required (10–300 chars). Style ONLY — genre, mood, BPM, key. No lyrics in this field.",
    }, { status: 400 });
  }
  if (body.prompt.trim().length > 300) {
    return NextResponse.json({
      error: "prompt must not exceed 300 chars. This field is STYLE ONLY.",
    }, { status: 400 });
  }
  if (body.lyrics && body.lyrics.length > 3000) {
    return NextResponse.json({ error: "lyrics must not exceed 3000 chars" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const provider = (body.provider ?? "music").toLowerCase();
  const endpoint = PROVIDER_ENDPOINTS[provider] ?? FAL_ENDPOINTS.MINIMAX_V26;

  // Insert generation_log before any fal call
  const generationId = crypto.randomUUID();
  await admin.from("generation_log").insert({
    id:              generationId,
    workspace_id:    workspaceId,
    generation_type: "music",
    model:           provider,
    fal_endpoint:    endpoint,
    input_params:    { prompt: body.prompt, lyrics: body.lyrics, is_instrumental: body.is_instrumental, topic: body.topic },
    fal_status:      "pending",
  });

  // Build fal input — schema differs per provider
  // MiniMax v2.6: { prompt (style), lyrics_prompt (words), is_instrumental, lyrics_optimizer }
  // ElevenLabs Music: { prompt (overall style), sections: [{ name, lyrics, duration_ms }] }
  const falInput: Record<string, unknown> = {};

  if (provider === "commercial") {
    // ElevenLabs Music schema
    falInput.prompt = body.prompt;
    if (body.lyrics) {
      falInput.sections = [{ name: "Main", lyrics: body.lyrics, duration_ms: 120000 }];
    }
    if (body.is_instrumental) falInput.force_instrumental = true;
  } else {
    // MiniMax schema (v2.6, v2.5, draft, ref)
    falInput.prompt = body.prompt;
    if (body.lyrics)              falInput.lyrics_prompt    = body.lyrics;
    if (body.is_instrumental)     falInput.is_instrumental  = true;
    if (body.lyrics_optimizer)    falInput.lyrics_optimizer = true;
    if (body.reference_audio_url) falInput.reference_audio_url = body.reference_audio_url;
  }

  const submitResult = await falSubmit(endpoint, falInput);

  if (!submitResult.ok) {
    await admin.from("generation_log").update({ fal_status: "failed", fal_error: submitResult.error }).eq("id", generationId);
    return NextResponse.json({ error: submitResult.error }, { status: 502 });
  }

  await admin.from("generation_log").update({
    fal_request_id: submitResult.responseUrl,
  }).eq("id", generationId);

  return NextResponse.json({
    generationId,
    responseUrl:  submitResult.responseUrl,
    status:       "queued",
    endpoint,
    provider,
  });
}
