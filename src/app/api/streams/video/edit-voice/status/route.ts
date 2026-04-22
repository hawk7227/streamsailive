/**
 * POST /api/streams/video/edit-voice/status
 *
 * Completes the voice edit pipeline after the initial TTS job finishes.
 * Reads pending_steps from video_versions.edit_metadata to know what remains.
 *
 * Pipeline completion (from audit — these steps MUST run in order):
 *   TTS done → 1. Sync Lipsync v2 (redraws mouth to match new audio)
 *              2. fal-ai/ffmpeg-api/compose (splices back at timestamp)
 *              → finalize video_versions.output_url
 *
 * Critical rules preserved:
 *   - compose NOT merge-videos for timestamp splice
 *   - Lipsync segment ≤ 15s (validated by edit-voice route at submission)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falPoll, falSubmit, extractAudioUrl, extractVideoUrl, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as { versionId?: string };
  if (!body.versionId) return NextResponse.json({ error: "versionId required" }, { status: 400 });

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

  const { data: ver } = await admin
    .from("video_versions")
    .select("*")
    .eq("id", body.versionId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!ver) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  if (ver.output_url) return NextResponse.json({ status: "done", outputUrl: ver.output_url });

  const meta = ver.edit_metadata as Record<string, unknown>;
  const pendingSteps = (meta.pending_steps as string[]) ?? [];
  const ttsRequestId = meta.tts_request_id as string;
  const videoUrl     = meta.video_url as string | undefined;
  const startMs      = meta.start_ms  as number;
  const endMs        = meta.end_ms    as number;

  // ── Step: poll TTS ────────────────────────────────────────────────────
  if (pendingSteps.includes("lipsync") && ttsRequestId) {
    const tts = await falPoll(ttsRequestId);
    if (tts.status === "processing") return NextResponse.json({ status: "processing", stage: "tts" });
    if (tts.status === "failed")     return NextResponse.json({ status: "failed", stage: "tts" });

    const audioUrl = extractAudioUrl(tts.raw);
    if (!audioUrl || !videoUrl) {
      await admin.from("video_versions").update({ edit_metadata: { ...meta, failed: "no_audio_url" } }).eq("id", body.versionId);
      return NextResponse.json({ status: "failed", stage: "tts_extract" });
    }

    // TTS done → submit Lipsync v2
    const lipsyncResult = await falSubmit(FAL_ENDPOINTS.SYNC_LIPSYNC, {
      video_url: videoUrl,
      audio_url: audioUrl,
    });

    if (!lipsyncResult.ok) return NextResponse.json({ status: "failed", error: lipsyncResult.error, stage: "lipsync_submit" });

    // Update pending steps: lipsync submitted, compose still pending
    await admin.from("video_versions").update({
      edit_metadata: {
        ...meta,
        lipsync_request_id: lipsyncResult.responseUrl,
        tts_audio_url:      audioUrl,
        pending_steps:      ["compose"],
      },
    }).eq("id", body.versionId);

    return NextResponse.json({ status: "processing", stage: "lipsync_submitted" });
  }

  // ── Step: poll Lipsync, then compose ─────────────────────────────────
  if (pendingSteps.includes("compose")) {
    const lipsyncId = meta.lipsync_request_id as string;
    if (!lipsyncId) return NextResponse.json({ status: "failed", error: "no lipsync_request_id" });

    const lipsync = await falPoll(lipsyncId);
    if (lipsync.status === "processing") return NextResponse.json({ status: "processing", stage: "lipsync" });
    if (lipsync.status === "failed")     return NextResponse.json({ status: "failed", stage: "lipsync" });

    const lipsyncVideoUrl = extractVideoUrl(lipsync.raw);
    if (!lipsyncVideoUrl || !videoUrl) {
      return NextResponse.json({ status: "failed", stage: "lipsync_extract" });
    }

    // Lipsync done → compose: splice lipsync segment back into original at timestamp
    // compose = timestamp-based splice (NOT merge-videos which is end-to-end concat)
    const composeResult = await falSubmit(FAL_ENDPOINTS.FFMPEG_COMPOSE, {
      video_url:    videoUrl,
      overlay_url:  lipsyncVideoUrl,
      start_time:   startMs / 1000,   // compose expects seconds
      end_time:     endMs   / 1000,
    });

    if (!composeResult.ok) return NextResponse.json({ status: "failed", error: composeResult.error, stage: "compose_submit" });

    await admin.from("video_versions").update({
      edit_metadata: { ...meta, compose_request_id: composeResult.responseUrl, pending_steps: [] },
    }).eq("id", body.versionId);

    return NextResponse.json({ status: "processing", stage: "compose_submitted" });
  }

  // ── Step: poll compose for final URL ─────────────────────────────────
  const composeId = meta.compose_request_id as string | undefined;
  if (composeId) {
    const compose = await falPoll(composeId);
    if (compose.status === "processing") return NextResponse.json({ status: "processing", stage: "compose" });
    if (compose.status === "failed")     return NextResponse.json({ status: "failed", stage: "compose" });

    const finalUrl = extractVideoUrl(compose.raw);
    if (!finalUrl) return NextResponse.json({ status: "failed", stage: "compose_extract" });

    await admin.from("video_versions").update({ output_url: finalUrl }).eq("id", body.versionId);
    return NextResponse.json({ status: "done", outputUrl: finalUrl });
  }

  return NextResponse.json({ status: "unknown", meta });
}
