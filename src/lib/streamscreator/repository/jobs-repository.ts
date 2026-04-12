import { createAdminClient } from '@/lib/supabase/admin';
import { type CreateJobInput, type Job, type RepositoryResult, repoErr, repoOk } from './types';

export async function createJob(input: CreateJobInput): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').insert({ project_id: input.project_id, type: input.type, phase: input.phase ?? null, progress: input.progress ?? 0 }).select().single<Job>();
  if (error !== null) return repoErr('JOB_CREATE_FAILED', 'Failed to create job in streams.jobs', error.message);
  return repoOk(data);
}

export async function getJobById(jobId: string): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').select().eq('id', jobId).single<Job>();
  if (error !== null) { if (error.code === 'PGRST116') return repoErr('JOB_NOT_FOUND', 'Job ' + jobId + ' not found'); return repoErr('JOB_FETCH_FAILED', 'Failed to fetch job from streams.jobs', error.message); }
  return repoOk(data);
}

export async function listJobsByProjectId(projectId: string): Promise<RepositoryResult<Job[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').select().eq('project_id', projectId).order('created_at', { ascending: false }).returns<Job[]>();
  if (error !== null) return repoErr('JOBS_LIST_FAILED', 'Failed to list jobs from streams.jobs', error.message);
  return repoOk(data);
}
