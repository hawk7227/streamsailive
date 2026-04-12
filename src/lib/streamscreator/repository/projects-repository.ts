import { createAdminClient } from '@/lib/supabase/admin';
import {
  type CreateProjectInput,
  type Project,
  type RepositoryResult,
  repoErr,
  repoOk,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// All operations target streams.projects exclusively.
// No fallback, no local adapter, no in-memory store.
// ─────────────────────────────────────────────────────────────────────────────

const TABLE = 'streams.projects' as const;

export async function createProject(
  input: CreateProjectInput,
): Promise<RepositoryResult<Project>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'pending',
      metadata: input.metadata ?? null,
    })
    .select()
    .single<Project>();

  if (error !== null) {
    return repoErr(
      'PROJECT_CREATE_FAILED',
      'Failed to create project in streams.projects',
      error.message,
    );
  }

  return repoOk(data);
}

export async function getProjectById(
  projectId: string,
): Promise<RepositoryResult<Project>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq('id', projectId)
    .single<Project>();

  if (error !== null) {
    if (error.code === 'PGRST116') {
      return repoErr('PROJECT_NOT_FOUND', `Project ${projectId} not found`);
    }
    return repoErr(
      'PROJECT_FETCH_FAILED',
      'Failed to fetch project from streams.projects',
      error.message,
    );
  }

  return repoOk(data);
}
