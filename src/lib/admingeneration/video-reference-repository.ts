import { createClient } from "@supabase/supabase-js";
import type {
  VideoReferenceAnalysisRecord,
  VideoReferenceAnalysisStatus,
  VideoReferenceBlueprint,
  VideoReferenceSourceType,
} from "./video-reference-blueprint";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function now() {
  return new Date().toISOString();
}

function toRecord(row: any): VideoReferenceAnalysisRecord {
  return {
    id: String(row.id),
    projectId: row.project_id || null,
    jobId: row.job_id || null,
    sourceType: row.source_type,
    sourceUrl: row.source_url || null,
    sourceAssetId: row.source_asset_id || null,
    status: row.status,
    blueprint: row.blueprint || null,
    transcript: row.transcript || null,
    summary: row.summary || null,
    error: row.error || null,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function referenceAnalysisTableSql() {
  return `create table if not exists streams.reference_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  job_id uuid null,
  source_type text not null,
  source_url text null,
  source_asset_id uuid null,
  status text not null default 'queued',
  blueprint jsonb null,
  transcript text null,
  summary text null,
  error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);`;
}

export async function createReferenceAnalysis(input: {
  projectId?: string | null;
  jobId?: string | null;
  sourceType: VideoReferenceSourceType;
  sourceUrl?: string | null;
  sourceAssetId?: string | null;
  status?: VideoReferenceAnalysisStatus;
  blueprint?: VideoReferenceBlueprint | null;
  transcript?: string | null;
  summary?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();

  const fallback: VideoReferenceAnalysisRecord = {
    id: crypto.randomUUID(),
    projectId: input.projectId || null,
    jobId: input.jobId || null,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl || null,
    sourceAssetId: input.sourceAssetId || null,
    status: input.status || "needs_worker",
    blueprint: input.blueprint || null,
    transcript: input.transcript || null,
    summary: input.summary || null,
    error: input.error || null,
    metadata: {
      ...(input.metadata || {}),
      persistence: "memory-fallback",
      requiredMigration: referenceAnalysisTableSql(),
    },
    createdAt: now(),
    updatedAt: now(),
  };

  if (!supabase) {
    return {
      persistence: false as const,
      persistenceError: "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
      record: fallback,
    };
  }

  const { data, error } = await supabase
    .schema("streams")
    .from("reference_analyses")
    .insert({
      project_id: input.projectId || null,
      job_id: input.jobId || null,
      source_type: input.sourceType,
      source_url: input.sourceUrl || null,
      source_asset_id: input.sourceAssetId || null,
      status: input.status || "needs_worker",
      blueprint: input.blueprint || null,
      transcript: input.transcript || null,
      summary: input.summary || null,
      error: input.error || null,
      metadata: input.metadata || {},
    })
    .select("*")
    .single();

  if (error) {
    return {
      persistence: false as const,
      persistenceError: error.message,
      record: fallback,
      requiredMigration: referenceAnalysisTableSql(),
    };
  }

  return { persistence: true as const, record: toRecord(data) };
}

export async function getReferenceAnalysis(id: string) {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return {
      persistence: false as const,
      error: "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
      record: null,
    };
  }

  const { data, error } = await supabase
    .schema("streams")
    .from("reference_analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { persistence: false as const, error: error.message, record: null };
  return { persistence: true as const, record: toRecord(data) };
}

export async function updateReferenceAnalysis(
  id: string,
  updates: Partial<{
    status: VideoReferenceAnalysisStatus;
    blueprint: VideoReferenceBlueprint | null;
    transcript: string | null;
    summary: string | null;
    error: string | null;
    metadata: Record<string, unknown>;
  }>,
) {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return { persistence: false as const, error: "Supabase admin is not configured.", record: null };
  }

  const payload: Record<string, unknown> = { updated_at: now() };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.blueprint !== undefined) payload.blueprint = updates.blueprint;
  if (updates.transcript !== undefined) payload.transcript = updates.transcript;
  if (updates.summary !== undefined) payload.summary = updates.summary;
  if (updates.error !== undefined) payload.error = updates.error;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  const { data, error } = await supabase
    .schema("streams")
    .from("reference_analyses")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { persistence: false as const, error: error.message, record: null };
  return { persistence: true as const, record: toRecord(data) };
}
