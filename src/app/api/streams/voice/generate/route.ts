/**
 * POST /api/streams/voice/generate
 *
 * ElevenLabs TTS via fal. Supports v3, Turbo v2.5, Multilingual v2.
 * Singing preset baked in for voice_id + music context:
 *   stability: 0.30, similarity_boost: 0.85, style: 0.80, speed: 0.95
 * Returns { generationId, responseUrl } — poll /api/streams/video/status.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { checkRateLimit } from "@/lib/streams/rate-limiter";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const MODEL_ENDPOINTS: Record<string, string> = {
  "voice-v3":      FAL_ENDPOINTS.ELEVENLABS_TTS,
  "turbo":         FAL_ENDPOINTS.ELEVENLABS_TTS_TURBO,
  "multilingual":  FAL_ENDPOINTS.ELEVENLABS_TTS,
};

// Singing preset — Rule 6: baked in, never configurable
const SINGING_PRESET = {
  stability:       0.30,   // Creative mode — natural vibrato, musical dynamics
  similarity_boost: 0.85,  // Strong voice identity match
  style:           0.80,   // High expressiveness for musical delivery
  speed:           0.95,   // Slightly slower — better phrasing
  // NO speaker_boost on v3 — degrades singing quality
} as const;

type RequestBody = {
  text:       string;
  voiceId?:   string;   // ElevenLabs voice_id (from IVC or preset)
  voiceName?: string;   // "Aria" | "Rachel" | "Adam" etc. (used if no voiceId)
  model?:     string;
  stability?:       number;
  similarity_boost?: number;
  speed?:           number;
  style?:           number;
  singing?:         boolean; // if true, apply SINGING_PRESET
  language_code?:   string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
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

  const model    = (body.model ?? "voice-v3").toLowerCase();
  const endpoint = MODEL_ENDPOINTS[model] ?? FAL_ENDPOINTS.ELEVENLABS_TTS;

  // Resolve preset — singing overrides user values
  const preset = body.singing ? SINGING_PRESET : {
    stability:        body.stability        ?? 0.50,
    similarity_boost: body.similarity_boost ?? 0.75,
    style:            body.style            ?? 0.00,
    speed:            body.speed            ?? 1.00,
  };

  const falInput: Record<string, unknown> = {
    text:             body.text.trim(),
    ...preset,
  };

  if (body.voiceId)       falInput.voice_id      = body.voiceId;
  if (body.voiceName)     falInput.voice          = body.voiceName;
  if (body.language_code) falInput.language_code  = body.language_code;

  const generationId = crypto.randomUUID();
  await admin.from("generation_log").insert({
    id:              generationId,
    workspace_id:    workspaceId,
    generation_type: "voice",
    model,
    fal_endpoint:    endpoint,
    input_params:    { text: body.text, voice_id: body.voiceId, singing: body.singing },
    fal_status:      "pending",
  });

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateResult = checkRateLimit(workspaceId);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // ── Cost enforcement ──────────────────────────────────────────────────────
  const { data: wSettings } = await admin
    .from("workspace_settings").select("cost_limit_daily_usd").eq("workspace_id", workspaceId).maybeSingle();
  const limitUsd = wSettings?.cost_limit_daily_usd ?? null;
  if (limitUsd != null && limitUsd > 0) {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const { data: rows } = await admin.from("generation_log").select("cost_usd")
      .eq("workspace_id", workspaceId).gte("created_at", todayStart.toISOString());
    const spent = (rows ?? []).reduce((s: number, r: {cost_usd: number|null}) => s + (r.cost_usd ?? 0), 0);
    if (spent >= limitUsd) {
      return NextResponse.json({ error: `Daily cost limit $${limitUsd.toFixed(2)} reached. Spent: $${spent.toFixed(2)}` }, { status: 402 });
    }
  }

  const submitResult = await falSubmit(endpoint, falInput);

  if (!submitResult.ok) {
    await admin.from("generation_log").update({ fal_status: "failed", fal_error: submitResult.error }).eq("id", generationId);
    return NextResponse.json({ error: submitResult.error }, { status: 502 });
  }

  await admin.from("generation_log").update({ fal_request_id: submitResult.responseUrl }).eq("id", generationId);

  return NextResponse.json({ generationId, responseUrl: submitResult.responseUrl, status: "queued", model });
}
