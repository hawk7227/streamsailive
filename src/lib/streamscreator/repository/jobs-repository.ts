import { createAdminClient } from '@/lib/supabase/admin';
import {
  type CreateJobInput,
  type Job,
  type RepositoryResult,
  repoErr,
  repoOk,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// All operations target streams.jobs exclusively.
// No fallback, no local adapter, no in-memory store.
// ─────────────────────────────────────────────────────────────────────────────


export async function createJob(
  input: CreateJobInput,
): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      project_id: input.project_id,
      type: input.type,
      status: input.status ?? 'queued',
      priority: input.priority ?? 0,
      payload: input.payload ?? null,
    })
    .select()
    .single<Job>();

  if (error !== null) {
    return repoErr(
      'JOB_CREATE_FAILED',
      'Failed to create job in streams.jobs',
      error.message,
    );
  }

  return repoOk(data);
}

export async function getJobById(
  jobId: string,
): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq('id', jobId)
    .single<Job>();

  if (error !== null) {
    if (error.code === 'PGRST116') {
      return repoErr('JOB_NOT_FOUND', `Job ${jobId} not found`);
    }
    return repoErr(
      'JOB_FETCH_FAILED',
      'Failed to fetch job from streams.jobs',
      error.message,
    );
  }

  return repoOk(data);
}

export async function listJobsByProjectId(
  projectId: string,
): Promise<RepositoryResult<Job[]>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .returns<Job[]>();

  if (error !== null) {
    return repoErr(
      'JOBS_LIST_FAILED',
      'Failed to list jobs from streams.jobs',
      error.message,
    );
  }

  return repoOk(data);
}
