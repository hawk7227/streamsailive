// ─────────────────────────────────────────────────────────────────────────────
// streams.* table shapes — kept in one file so every repository imports from
// the same single source of truth.  All fields match the Postgres column names
// exactly; nullable columns are typed `| null`.
// ─────────────────────────────────────────────────────────────────────────────

// ── streams.projects ─────────────────────────────────────────────────────────

export type ProjectStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
}

// ── streams.jobs ─────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  project_id: string;
  type: string;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobInput {
  project_id: string;
  type: string;
  status?: JobStatus;
  priority?: number;
  payload?: Record<string, unknown>;
}

// ── streams.assets ────────────────────────────────────────────────────────────

export type AssetType = 'video' | 'audio' | 'image' | 'document' | 'other';
export type AssetStatus = 'pending' | 'uploaded' | 'processed' | 'failed';

export interface Asset {
  id: string;
  project_id: string;
  job_id: string | null;
  type: AssetType;
  status: AssetStatus;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_key: string | null;
  public_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssetInput {
  project_id: string;
  job_id?: string;
  type: AssetType;
  status?: AssetStatus;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
  storage_key?: string;
  public_url?: string;
  metadata?: Record<string, unknown>;
}

// ── streams.job_events ───────────────────────────────────────────────────────

export type JobEventType =
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'provider.attempt'
  | 'provider.success'
  | 'provider.failure';

export interface JobEvent {
  id: string;
  job_id: string;
  type: JobEventType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateJobEventInput {
  job_id: string;
  type: JobEventType;
  payload?: Record<string, unknown>;
}

// ── streams.provider_runs ────────────────────────────────────────────────────

export type ProviderRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'timed_out';

export interface ProviderRun {
  id: string;
  job_id: string;
  provider: string;
  status: ProviderRunStatus;
  attempt: number;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateProviderRunInput {
  job_id: string;
  provider: string;
  status?: ProviderRunStatus;
  attempt?: number;
  request_payload?: Record<string, unknown>;
}

// ── Shared repository result wrapper ─────────────────────────────────────────

export type RepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepositoryError };

export interface RepositoryError {
  code: string;
  message: string;
  detail?: string;
}

export function repoOk<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

export function repoErr(
  code: string,
  message: string,
  detail?: string,
): RepositoryResult<never> {
  return { data: null, error: { code, message, detail } };
}
