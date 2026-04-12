import { createAdminClient } from '@/lib/supabase/admin';
import { type RepositoryResult, repoErr, repoOk } from '../repository/types';
import { type Job } from '../repository/types';
import { createJobEvent } from '../repository/job-events-repository';

async function updateJobPhase(jobId: string, phase: string, progress: number): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').update({ phase, progress }).eq('id', jobId).select().single<Job>();
  if (error !== null) return repoErr('JOB_UPDATE_FAILED', 'Failed to update job phase in streams.jobs', error.message);
  return repoOk(data);
}

export async function createQueuedJob(projectId: string, type: string): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').insert({ project_id: projectId, type, phase: 'queued', progress: 0 }).select().single<Job>();
  if (error !== null) return repoErr('JOB_CREATE_FAILED', 'Failed to create queued job in streams.jobs', error.message);
  await createJobEvent({ job_id: data.id, phase: 'queued', message: 'Job created and queued' });
  return repoOk(data);
}

export async function markJobRunning(jobId: string): Promise<RepositoryResult<Job>> {
  const result = await updateJobPhase(jobId, 'running', 0);
  if (result.error !== null) return result;
  await createJobEvent({ job_id: jobId, phase: 'running', message: 'Job started running' });
  return result;
}

export async function markJobSucceeded(jobId: string): Promise<RepositoryResult<Job>> {
  const result = await updateJobPhase(jobId, 'succeeded', 100);
  if (result.error !== null) return result;
  await createJobEvent({ job_id: jobId, phase: 'succeeded', message: 'Job completed successfully' });
  return result;
}

export async function markJobFailed(jobId: string, reason: string): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').update({ phase: 'failed', error: reason }).eq('id', jobId).select().single<Job>();
  if (error !== null) return repoErr('JOB_UPDATE_FAILED', 'Failed to mark job failed in streams.jobs', error.message);
  await createJobEvent({ job_id: jobId, phase: 'failed', message: reason });
  return repoOk(data);
}

export async function getJobStatus(jobId: string): Promise<RepositoryResult<Job>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('jobs').select().eq('id', jobId).single<Job>();
  if (error !== null) { if (error.code === 'PGRST116') return repoErr('JOB_NOT_FOUND', 'Job ' + jobId + ' not found'); return repoErr('JOB_FETCH_FAILED', 'Failed to fetch job from streams.jobs', error.message); }
  return repoOk(data);
}
