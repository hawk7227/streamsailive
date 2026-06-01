import { createClient } from "@supabase/supabase-js";
import { getReferenceAnalysis } from "./video-reference-repository";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function workerJobMigrationHint() {
  return "Run migration 20260601002000_create_streams_video_editor_and_worker_jobs.sql";
}

export async function createAnalyzerWorkerJob(input: {
  analysisId: string;
  requestedProfile?: "card_standard" | "editor_full" | "admin_full";
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: workerJobMigrationHint() };

  const reference = await getReferenceAnalysis(input.analysisId);
  if (!reference.record) return { ok: false as const, error: reference.error || "Reference analysis not found." };

  const result = await supabase
    .schema("streams")
    .from("video_analysis_worker_jobs")
    .insert({
      analysis_id: input.analysisId,
      project_id: reference.record.projectId,
      source_url: reference.record.sourceUrl,
      source_asset_id: reference.record.sourceAssetId,
      requested_profile: input.requestedProfile || "admin_full",
      status: "queued",
      stage: "queued",
      metadata: {
        sourceType: reference.record.sourceType,
        sourceTitle: reference.record.blueprint?.summary?.title || reference.record.summary || null,
        requiredCapabilities: reference.record.metadata?.requiredWorkerCapabilities || [],
      },
    })
    .select("*")
    .single();

  if (result.error || !result.data) {
    return { ok: false as const, error: result.error?.message || "Worker job insert failed.", requiredMigration: workerJobMigrationHint() };
  }

  return { ok: true as const, job: result.data, analysis: reference.record };
}

export async function getAnalyzerWorkerJob(analysisId: string, jobId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: workerJobMigrationHint() };

  const result = await supabase
    .schema("streams")
    .from("video_analysis_worker_jobs")
    .select("*")
    .eq("analysis_id", analysisId)
    .eq("id", jobId)
    .single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Worker job not found." };
  return { ok: true as const, job: result.data };
}

export async function updateAnalyzerWorkerJob(input: {
  analysisId: string;
  jobId: string;
  status?: string;
  stage?: string;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
  started?: boolean;
  completed?: boolean;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) patch.status = input.status;
  if (input.stage) patch.stage = input.stage;
  if (input.lastError !== undefined) patch.last_error = input.lastError;
  if (input.metadata) patch.metadata = input.metadata;
  if (input.started) patch.started_at = new Date().toISOString();
  if (input.completed) patch.completed_at = new Date().toISOString();

  const result = await supabase
    .schema("streams")
    .from("video_analysis_worker_jobs")
    .update(patch)
    .eq("analysis_id", input.analysisId)
    .eq("id", input.jobId)
    .select("*")
    .single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Worker job update failed." };
  return { ok: true as const, job: result.data };
}
