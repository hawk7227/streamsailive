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

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const supabase = admin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase admin not configured" }, { status: 500 });

  const [project, versions, qcReports] = await Promise.all([
    supabase.schema("streams").from("video_editor_projects").select("*").eq("id", id).single(),
    supabase.schema("streams").from("video_editor_versions").select("*").eq("editor_project_id", id).order("created_at", { ascending: false }),
    supabase.schema("streams").from("video_editor_qc_reports").select("*").eq("editor_project_id", id).order("created_at", { ascending: false }),
  ]);

  if (project.error || !project.data) {
    return NextResponse.json({ ok: false, error: project.error?.message || "Editor project not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-versions",
    editorProjectId: id,
    activeVersionId: project.data.active_version_id,
    versions: versions.data || [],
    qcReports: qcReports.data || [],
  });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const supabase = admin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase admin not configured" }, { status: 500 });

  const action = String(body.action || "");
  const versionId = String(body.versionId || "");

  if (!versionId) return NextResponse.json({ ok: false, error: "versionId is required" }, { status: 400 });

  if (action === "activate") {
    const qc = await supabase.schema("streams").from("video_editor_qc_reports").select("*").eq("version_id", versionId).order("created_at", { ascending: false }).limit(1);
    const latest = qc.data?.[0];
    if (latest && latest.passed === false) {
      return NextResponse.json({ ok: false, error: "Cannot activate version because latest QC failed.", qcReport: latest }, { status: 409 });
    }

    const update = await supabase.schema("streams").from("video_editor_projects").update({
      active_version_id: versionId,
      status: "ready",
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();

    if (update.error || !update.data) {
      return NextResponse.json({ ok: false, error: update.error?.message || "Activation failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, route: "admingeneration-editor-versions", action, project: update.data });
  }

  return NextResponse.json({ ok: false, error: "Unsupported action. Use action=activate." }, { status: 400 });
}
