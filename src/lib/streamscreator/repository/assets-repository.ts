import { createAdminClient } from '@/lib/supabase/admin';
import { type Asset, type CreateAssetInput, type RepositoryResult, repoErr, repoOk } from './types';

export async function createAsset(input: CreateAssetInput): Promise<RepositoryResult<Asset>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('assets').insert({ project_id: input.project_id, type: input.type, storage_key: input.storage_key ?? null, mime_type: input.mime_type ?? null, provider: input.provider ?? null, status: input.status ?? 'pending' }).select().single<Asset>();
  if (error !== null) return repoErr('ASSET_CREATE_FAILED', 'Failed to create asset in streams.assets', error.message);
  return repoOk(data);
}

export async function listAssetsByProjectId(projectId: string): Promise<RepositoryResult<Asset[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema('streams').from('assets').select().eq('project_id', projectId).order('created_at', { ascending: false }).returns<Asset[]>();
  if (error !== null) return repoErr('ASSETS_LIST_FAILED', 'Failed to list assets from streams.assets', error.message);
  return repoOk(data);
}
