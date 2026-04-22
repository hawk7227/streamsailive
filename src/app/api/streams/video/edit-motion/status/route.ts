/**
 * POST /api/streams/video/edit-motion/status
 *
 * Completes the motion edit pipeline after the I2V job finishes.
 * Reads compose_request_id / i2v_request_id from video_versions.edit_metadata.
 *
 * Pipeline:
 *   I2V job done → fal-ai/ffmpeg-api/compose (splice new shot at start/end timestamps)
 *                → finalize video_versions.output_url
 *
 * compose = timestamp-based splice (correct for shot replacement)
 * merge-videos = end-to-end concat (stitch only — NOT used here)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falPoll, falSubmit, extractVideoUrl, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

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

  const meta       = ver.edit_metadata as Record<string, unknown>;
  const i2vId      = meta.i2v_request_id   as string | undefined;
  const composeId  = meta.compose_request_id as string | undefined;
  const startMs    = meta.start_ms as number;
  const endMs      = meta.end_ms   as number;
  const videoUrl   = meta.video_url as string | undefined;

  // ── Phase 1: poll I2V ─────────────────────────────────────────────────
  if (i2vId && !composeId) {
    const i2v = await falPoll(i2vId);
    if (i2v.status === "processing") return NextResponse.json({ status: "processing", stage: "i2v" });
    if (i2v.status === "failed")     return NextResponse.json({ status: "failed",     stage: "i2v" });

    const newShotUrl = extractVideoUrl(i2v.raw);
    if (!newShotUrl) return NextResponse.json({ status: "failed", stage: "i2v_extract" });

    if (!videoUrl) {
      // No original video to splice into — return the new shot directly
      await admin.from("video_versions").update({ output_url: newShotUrl }).eq("id", body.versionId);
      return NextResponse.json({ status: "done", outputUrl: newShotUrl });
    }

    // I2V done → compose: splice new shot back into original at shot timestamps
    const composeResult = await falSubmit(FAL_ENDPOINTS.FFMPEG_COMPOSE, {
      video_url:   videoUrl,
      overlay_url: newShotUrl,
      start_time:  startMs / 1000,
      end_time:    endMs   / 1000,
    });

    if (!composeResult.ok) return NextResponse.json({ status: "failed", error: composeResult.error, stage: "compose_submit" });

    await admin.from("video_versions").update({
      edit_metadata: { ...meta, compose_request_id: composeResult.responseUrl, new_shot_url: newShotUrl },
    }).eq("id", body.versionId);

    return NextResponse.json({ status: "processing", stage: "compose_submitted" });
  }

  // ── Phase 2: poll compose ─────────────────────────────────────────────
  if (composeId) {
    const compose = await falPoll(composeId);
    if (compose.status === "processing") return NextResponse.json({ status: "processing", stage: "compose" });
    if (compose.status === "failed")     return NextResponse.json({ status: "failed",     stage: "compose" });

    const finalUrl = extractVideoUrl(compose.raw);
    if (!finalUrl) return NextResponse.json({ status: "failed", stage: "compose_extract" });

    await admin.from("video_versions").update({ output_url: finalUrl }).eq("id", body.versionId);
    return NextResponse.json({ status: "done", outputUrl: finalUrl });
  }

  return NextResponse.json({ status: "unknown", meta });
}
