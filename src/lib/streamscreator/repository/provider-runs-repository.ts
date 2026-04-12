import { createAdminClient } from '@/lib/supabase/admin';
import { type CreateProviderRunInput, type ProviderRun, type RepositoryResult, repoErr, repoOk } from './types';
export async function createProviderRun(input: CreateProviderRunInput): Promise<RepositoryResult<ProviderRun>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('provider_runs').insert({ job_id: input.job_id, provider: input.provider, status: input.status ?? 'pending', attempt: input.attempt ?? 1, request_payload: input.request_payload ?? null }).select().single<ProviderRun>();
  if (error !== null) return repoErr('PROVIDER_RUN_CREATE_FAILED', 'Failed to create provider run in streams.provider_runs', error.message);
  return repoOk(data);
}
export async function listProviderRunsByJobId(jobId: string): Promise<RepositoryResult<ProviderRun[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('provider_runs').select().eq('job_id', jobId).order('attempt', { ascending: true }).returns<ProviderRun[]>();
  if (error !== null) return repoErr('PROVIDER_RUNS_LIST_FAILED', 'Failed to list provider runs from streams.provider_runs', error.message);
  return repoOk(data);
}
