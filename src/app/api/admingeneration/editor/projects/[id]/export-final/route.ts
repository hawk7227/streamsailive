import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const stitch = await supabase.schema("streams").from("video_editor_stitch_jobs").insert({
    editor_project_id: id,
    active_version_id: body.versionId || project.data.active_version_id || null,
    status: body.outputUrl || body.outputAssetId ? "completed_external_output_supplied" : "blocked_ffmpeg_worker_required",
    timeline_snapshot: body.timelineSnapshot || {},
    output_asset_id: body.outputAssetId || null,
    error: body.outputUrl || body.outputAssetId ? null : "FFmpeg render/stitch worker is not wired for this request. No fake export created.",
    metadata: {
      source: "export-final-route",
      outputUrl: body.outputUrl || null,
      blockedReason: body.outputUrl || body.outputAssetId ? null : "Attach a real render worker or supply real outputUrl/outputAssetId.",
    },
    completed_at: body.outputUrl || body.outputAssetId ? new Date().toISOString() : null,
  }).select("*").single();

  if (stitch.error || !stitch.data) {
    return NextResponse.json({ ok: false, error: stitch.error?.message || "Stitch job insert failed" }, { status: 500 });
  }

  const exportInsert = await supabase.schema("streams").from("video_editor_exports").insert({
    editor_project_id: id,
    stitch_job_id: stitch.data.id,
    version_id: body.versionId || project.data.active_version_id || null,
    export_type: body.exportType || "mp4",
    status: body.outputUrl || body.outputAssetId ? "completed" : "blocked_render_worker_required",
    output_url: body.outputUrl || null,
    output_asset_id: body.outputAssetId || null,
    settings: body.settings || {},
    error: body.outputUrl || body.outputAssetId ? null : "Render/export worker is not wired for this request. No fake download created.",
    metadata: {
      source: "export-final-route",
      blockedReason: body.outputUrl || body.outputAssetId ? null : "Real render output required before completion.",
    },
    completed_at: body.outputUrl || body.outputAssetId ? new Date().toISOString() : null,
  }).select("*").single();

  if (exportInsert.error || !exportInsert.data) {
    return NextResponse.json({ ok: false, error: exportInsert.error?.message || "Export insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-export-final",
    editorProjectId: id,
    status: exportInsert.data.status,
    stitchJob: stitch.data,
    exportRequest: exportInsert.data,
  });
}
