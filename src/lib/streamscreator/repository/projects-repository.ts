import { createAdminClient } from '@/lib/supabase/admin';
import { type CreateProjectInput, type Project, type RepositoryResult, repoErr, repoOk } from './types';

export async function createProject(input: CreateProjectInput): Promise<RepositoryResult<Project>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('projects').insert({ name: input.name, mode: input.mode ?? null, status: input.status ?? 'pending' }).select().single<Project>();
  if (error !== null) return repoErr('PROJECT_CREATE_FAILED', 'Failed to create project in streams.projects', error.message);
  return repoOk(data);
}

export async function getProjectById(projectId: string): Promise<RepositoryResult<Project>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('projects').select().eq('id', projectId).single<Project>();
  if (error !== null) { if (error.code === 'PGRST116') return repoErr('PROJECT_NOT_FOUND', 'Project ' + projectId + ' not found'); return repoErr('PROJECT_FETCH_FAILED', 'Failed to fetch project from streams.projects', error.message); }
  return repoOk(data);
}
