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

async function getProject(supabase: any, id: string) {
  return supabase.schema("streams").from("video_editor_projects").select("*").eq("id", id).single();
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const supabase = admin();

  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase admin not configured" }, { status: 500 });
  if (!id) return NextResponse.json({ ok: false, error: "editor project id is required" }, { status: 400 });

  const projectResult = await getProject(supabase, id);
  if (projectResult.error || !projectResult.data) {
    return NextResponse.json({ ok: false, error: projectResult.error?.message || "Editor project not found" }, { status: 404 });
  }

  const instruction = String(body.instruction || body.prompt || "").trim();
  if (!instruction) return NextResponse.json({ ok: false, error: "instruction or prompt is required" }, { status: 400 });

  const provider = String(body.provider || "provider_router");
  const action = String(body.action || "segment_edit");
  const targetType = String(body.targetType || "project");
  const targetId = typeof body.targetId === "string" ? body.targetId : null;

  const editInsert = await supabase.schema("streams").from("video_editor_edit_instructions").insert({
    editor_project_id: id,
    version_id: body.versionId || projectResult.data.active_version_id || null,
    target_type: targetType,
    target_id: targetId,
    instruction,
    status: body.outputAssetId || body.outputUrl ? "ready_for_qc" : "blocked_provider_not_wired",
    metadata: {
      source: "execute-edit-route",
      request: body,
      blockedReason: body.outputAssetId || body.outputUrl ? null : "Provider adapter/output was not supplied. Request persisted without fake execution.",
    },
  }).select("*").single();

  if (editInsert.error || !editInsert.data) {
    return NextResponse.json({ ok: false, error: editInsert.error?.message || "Edit instruction insert failed" }, { status: 500 });
  }

  const providerRunInsert = await supabase.schema("streams").from("video_editor_provider_runs").insert({
    editor_project_id: id,
    version_id: body.versionId || projectResult.data.active_version_id || null,
    edit_instruction_id: editInsert.data.id,
    provider,
    action,
    target_type: targetType,
    target_id: targetId,
    status: body.outputAssetId || body.outputUrl ? "completed_external_output_supplied" : "blocked_provider_not_wired",
    request: body,
    response: body.outputAssetId || body.outputUrl ? { outputAssetId: body.outputAssetId || null, outputUrl: body.outputUrl || null } : null,
    output_asset_id: body.outputAssetId || null,
    error: body.outputAssetId || body.outputUrl ? null : "Provider execution is not wired for this request. No fake output was created.",
    completed_at: body.outputAssetId || body.outputUrl ? new Date().toISOString() : null,
  }).select("*").single();

  if (providerRunInsert.error || !providerRunInsert.data) {
    return NextResponse.json({ ok: false, error: providerRunInsert.error?.message || "Provider run insert failed" }, { status: 500 });
  }

  let version = null;
  let qcReport = null;

  if (body.outputAssetId || body.outputUrl) {
    const versionInsert = await supabase.schema("streams").from("video_editor_versions").insert({
      editor_project_id: id,
      parent_version_id: body.versionId || projectResult.data.active_version_id || null,
      output_asset_id: body.outputAssetId || null,
      status: "pending_qc",
      change_summary: instruction,
      metadata: {
        source: "execute-edit-route",
        providerRunId: providerRunInsert.data.id,
        outputUrl: body.outputUrl || null,
      },
    }).select("*").single();

    if (!versionInsert.error && versionInsert.data) {
      version = versionInsert.data;
      const qcInsert = await supabase.schema("streams").from("video_editor_qc_reports").insert({
        editor_project_id: id,
        version_id: version.id,
        provider_run_id: providerRunInsert.data.id,
        status: "pending_model_qc",
        checks: {},
        issues: [],
        passed: null,
        metadata: { source: "execute-edit-route", reason: "Output supplied; QA must run before activation." },
      }).select("*").single();
      qcReport = qcInsert.data || null;
    }
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-execute-edit",
    editorProjectId: id,
    status: providerRunInsert.data.status,
    editInstruction: editInsert.data,
    providerRun: providerRunInsert.data,
    version,
    qcReport,
  });
}
