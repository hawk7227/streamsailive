import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { dispatchProvider, persistProviderDispatch } from "@/lib/admingeneration/runtime/provider-router";
import { storeRemoteOutput } from "@/lib/admingeneration/runtime/storage";
import { updateWorkerJob } from "@/lib/admingeneration/runtime/worker-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providerRunId = body.providerRunId || body.id;
    if (body.workerJobId) await updateWorkerJob(body.workerJobId, { status: "running", locked_at: new Date().toISOString() });
    if (!providerRunId) return NextResponse.json({ ok: false, error: "providerRunId is required." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { data: run, error } = await supabase.from("admingeneration_provider_runs").select("*").eq("id", providerRunId).single();
    if (error || !run) return NextResponse.json({ ok: false, error: error?.message || "Provider run not found." }, { status: 404 });

    const requestPayload = { ...(run.request || {}), providerRunId, projectId: run.project_id, provider: run.provider, action: run.action };
    const result = await dispatchProvider(requestPayload);
    const updatedRun = await persistProviderDispatch(requestPayload, result);

    let stored = null;
    if (result.outputUrl && run.project_id) {
      stored = await storeRemoteOutput({
        projectId: run.project_id,
        url: result.outputUrl,
        assetKind: "provider_output",
        mimeType: body.mimeType || "video/mp4",
        metadata: { provider: result.provider, providerRunId },
      });

      await supabase.from("admingeneration_provider_runs").update({ output_asset_id: stored.assetId }).eq("id", providerRunId);
      if (run.version_id) {
        await supabase.from("admingeneration_versions").update({ output_asset_id: stored.assetId, status: "ready_for_qc" }).eq("id", run.version_id);
      }
    }

    if (body.workerJobId) {
      await updateWorkerJob(body.workerJobId, {
        status: result.status === "completed" ? "completed" : result.status === "submitted" ? "queued" : "failed",
        response: { result, stored },
        completed_at: result.status === "completed" ? new Date().toISOString() : null,
        error: result.error || null,
      });
    }

    return NextResponse.json({ ok: result.status === "completed" || result.status === "submitted", status: result.status, providerRun: updatedRun, result, stored });
  } catch (error) {
    return NextResponse.json({ ok: false, status: "failed", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
