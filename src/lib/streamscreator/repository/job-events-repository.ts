import { createAdminClient } from '@/lib/supabase/admin';
import { type RepositoryResult, repoErr, repoOk } from './types';

export interface JobEvent {
  id: string;
  job_id: string;
  phase: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CreateJobEventInput {
  job_id: string;
  phase: string;
  message: string;
  payload?: Record<string, unknown>;
}

export async function createJobEvent(input: CreateJobEventInput): Promise<RepositoryResult<JobEvent>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('job_events').insert({ job_id: input.job_id, phase: input.phase, message: input.message, payload: input.payload ?? {} }).select().single<JobEvent>();
  if (error !== null) return repoErr('JOB_EVENT_CREATE_FAILED', 'Failed to create job event in streams.job_events', error.message);
  return repoOk(data);
}

export async function listJobEventsByJobId(jobId: string): Promise<RepositoryResult<JobEvent[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('job_events').select().eq('job_id', jobId).order('created_at', { ascending: true }).returns<JobEvent[]>();
  if (error !== null) return repoErr('JOB_EVENTS_LIST_FAILED', 'Failed to list job events from streams.job_events', error.message);
  return repoOk(data);
}
