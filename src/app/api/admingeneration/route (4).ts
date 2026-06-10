import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { storeRemoteOutput } from "@/lib/admingeneration/runtime/storage";
import { updateWorkerJob } from "@/lib/admingeneration/runtime/worker-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Json = Record<string, any>;

function firstUrl(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    return (
      value.outputUrl ||
      value.videoUrl ||
      value.assetUrl ||
      value.url ||
      value.video?.url ||
      value.image?.url ||
      value.audio?.url ||
      firstUrl(value.output) ||
      firstUrl(value.outputs) ||
      firstUrl(value.result) ||
      firstUrl(value.data) ||
      firstUrl(value.images) ||
      firstUrl(value.videos) ||
      null
    );
  }
  return null;
}

function terminalStatus(data: Json) {
  const raw = String(data.status || data.state || data.status_text || "").toLowerCase();
  const done = ["completed", "succeeded", "success", "finished", "done"].includes(raw);
  const failed = ["failed", "error", "cancelled", "canceled"].includes(raw);
  return { raw, done, failed };
}

async function falFetch(path: string) {
  const key = process.env.FAL_API_KEY || process.env.FAL_KEY;
  if (!key) throw new Error("FAL_API_KEY or FAL_KEY is not configured.");
  const response = await fetch(path, { headers: { Authorization: `Key ${key}` }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`fal.ai polling failed with HTTP ${response.status}.`);
  return data;
}

async function pollFal(providerJobId: string, providerModel?: string | null) {
  const statusUrl = providerModel
    ? `https://queue.fal.run/${providerModel}/requests/${providerJobId}/status`
    : `https://queue.fal.run/requests/${providerJobId}/status`;
  const status = await falFetch(statusUrl);
  const state = terminalStatus(status);
  if (!state.done || !providerModel) return status;

  const result = await falFetch(`https://queue.fal.run/${providerModel}/requests/${providerJobId}`);
  return { ...status, result, outputUrl: firstUrl(result) };
}

async function pollConfiguredEndpoint(provider: string, providerJobId: string) {
  const prefix = provider.toUpperCase();
  const endpoint = process.env[`${prefix}_STATUS_ENDPOINT`] || process.env[`${prefix}_POLL_ENDPOINT`];
  const key = process.env[`${prefix}_API_KEY`];
  if (!endpoint) throw new Error(`${prefix}_STATUS_ENDPOINT or ${prefix}_POLL_ENDPOINT is not configured.`);
  const url = endpoint.includes("{id}") ? endpoint.replace("{id}", encodeURIComponent(providerJobId)) : `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(providerJobId)}`;
  const response = await fetch(url, {
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = await response.json().catch(async () => ({ text: await response.text().catch(() => "") }));
  if (!response.ok) throw new Error(`${provider} polling failed with HTTP ${response.status}.`);
  return { ...data, outputUrl: firstUrl(data) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseServiceClient();

    let job = null;
    if (body.workerJobId) {
      const found = await supabase.from("admingeneration_worker_jobs").select("*").eq("id", body.workerJobId).single();
      if (found.error) throw found.error;
      job = found.data;
    } else {
      const found = await supabase
        .from("admingeneration_worker_jobs")
        .select("*")
        .eq("job_type", "provider_poll")
        .in("status", ["queued", "running"])
        .lte("run_after", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (found.error) throw found.error;
      job = found.data;
    }

    if (!job) return NextResponse.json({ ok: true, status: "idle", message: "No provider poll jobs are ready." });
    await updateWorkerJob(job.id, { status: "running", locked_at: new Date().toISOString(), attempts: Number(job.attempts || 0) + 1 });

    const requestPayload = job.request || {};
    const provider = String(requestPayload.provider || "").toLowerCase();
    const providerJobId = requestPayload.providerJobId;
    const providerModel = requestPayload.providerModel || requestPayload.model || null;
    if (!providerJobId) throw new Error("Worker job is missing providerJobId.");

    let pollResult: Json;
    if (provider === "fal") pollResult = await pollFal(providerJobId, providerModel);
    else if (["runway", "kling", "veo", "openai", "external"].includes(provider)) pollResult = await pollConfiguredEndpoint(provider, providerJobId);
    else throw new Error(`Polling is not configured for provider ${provider}.`);

    const state = terminalStatus(pollResult);
    const outputUrl = firstUrl(pollResult);
    let stored: any = null;

    if (state.done && outputUrl && job.project_id) {
      stored = await storeRemoteOutput({
        projectId: job.project_id,
        url: outputUrl,
        assetKind: requestPayload.assetKind || "provider_output",
        mimeType: requestPayload.mimeType || "video/mp4",
        metadata: { provider, providerJobId, providerModel, workerJobId: job.id, pollResult },
      });
    }

    const updated = await updateWorkerJob(job.id, {
      status: state.done ? "completed" : state.failed ? "failed" : "queued",
      response: { ...pollResult, stored },
      error: state.failed ? JSON.stringify(pollResult) : null,
      completed_at: state.done || state.failed ? new Date().toISOString() : null,
      run_after: state.done || state.failed ? new Date().toISOString() : new Date(Date.now() + 30000).toISOString(),
    });

    if (job.provider_run_id) {
      await supabase.from("admingeneration_provider_runs").update({
        status: state.done ? "completed" : state.failed ? "failed" : "submitted",
        response: { ...pollResult, stored },
        output_asset_id: stored?.assetId || null,
        error: state.failed ? JSON.stringify(pollResult) : null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.provider_run_id);
    }

    if (stored?.assetId && requestPayload.versionId) {
      await supabase.from("admingeneration_versions").update({
        output_asset_id: stored.assetId,
        status: "ready_for_qc",
      }).eq("id", requestPayload.versionId);
    }

    return NextResponse.json({ ok: !state.failed, status: updated.status, outputUrl, stored, workerJob: updated, pollResult });
  } catch (error) {
    return NextResponse.json({ ok: false, status: "failed", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
