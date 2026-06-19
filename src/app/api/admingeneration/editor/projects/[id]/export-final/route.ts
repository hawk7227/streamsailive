import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { composeFinalExport } from "@/lib/admingeneration/editor/compose-final-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const supabase = admin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase admin not configured" }, { status: 500 });

  const project = await supabase.schema("streams").from("video_editor_projects").select("*").eq("id", id).single();
  if (project.error || !project.data) {
    return NextResponse.json({ ok: false, error: project.error?.message || "Editor project not found" }, { status: 404 });
  }

  const compose = await composeFinalExport({
    projectId: id,
    timelineSnapshot: body.timelineSnapshot || body.settings?.timelineSnapshot || {},
    outputUrl: body.outputUrl || null,
    outputAssetId: body.outputAssetId || null,
    videoUrls: body.videoUrls || body.settings?.videoUrls || [],
    voiceoverUrl: body.voiceoverUrl || body.settings?.voiceoverUrl || null,
    musicUrl: body.musicUrl || body.settings?.musicUrl || null,
    sfxUrls: body.sfxUrls || body.settings?.sfxUrls || [],
    subtitleText: body.subtitleText || body.settings?.subtitleText || null,
  });

  const hasRealOutput = compose.ok && compose.outputUrl;
  const outputUrl = hasRealOutput ? compose.outputUrl : body.outputUrl || null;
  const outputAssetId = body.outputAssetId || null;
  const blockedReason = hasRealOutput
    ? null
    : compose.ok
      ? null
      : compose.reason || "Attach a real render worker or supply real outputUrl/outputAssetId.";

  const stitch = await supabase.schema("streams").from("video_editor_stitch_jobs").insert({
    editor_project_id: id,
    active_version_id: body.versionId || project.data.active_version_id || null,
    status: hasRealOutput || outputAssetId ? "completed" : "blocked_ffmpeg_worker_required",
    timeline_snapshot: body.timelineSnapshot || {},
    output_asset_id: outputAssetId,
    error: hasRealOutput || outputAssetId ? null : blockedReason,
    metadata: {
      source: "export-final-route",
      outputUrl,
      compose: compose.ok ? compose.metadata : compose.metadata || null,
      blockedReason,
    },
    completed_at: hasRealOutput || outputAssetId ? new Date().toISOString() : null,
  }).select("*").single();

  if (stitch.error || !stitch.data) {
    return NextResponse.json({ ok: false, error: stitch.error?.message || "Stitch job insert failed" }, { status: 500 });
  }

  const exportInsert = await supabase.schema("streams").from("video_editor_exports").insert({
    editor_project_id: id,
    stitch_job_id: stitch.data.id,
    version_id: body.versionId || project.data.active_version_id || null,
    export_type: body.exportType || "mp4",
    status: hasRealOutput || outputAssetId ? "completed" : "blocked_render_worker_required",
    output_url: outputUrl,
    output_asset_id: outputAssetId,
    settings: body.settings || {},
    error: hasRealOutput || outputAssetId ? null : blockedReason,
    metadata: {
      source: "export-final-route",
      compose: compose.ok ? compose.metadata : compose.metadata || null,
      blockedReason,
    },
    completed_at: hasRealOutput || outputAssetId ? new Date().toISOString() : null,
  }).select("*").single();

  if (exportInsert.error || !exportInsert.data) {
    return NextResponse.json({ ok: false, error: exportInsert.error?.message || "Export insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-export-final",
    editorProjectId: id,
    status: exportInsert.data.status,
    outputUrl,
    stitchJob: stitch.data,
    exportRequest: exportInsert.data,
    compose,
  });
}
