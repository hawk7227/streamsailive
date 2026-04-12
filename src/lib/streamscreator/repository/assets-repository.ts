import { createAdminClient } from '@/lib/supabase/admin';
import { type Asset, type CreateAssetInput, type RepositoryResult, repoErr, repoOk } from './types';
const TABLE = 'streams.assets' as const;
export async function createAsset(input: CreateAssetInput): Promise<RepositoryResult<Asset>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).insert({ project_id: input.project_id, job_id: input.job_id ?? null, type: input.type, status: input.status ?? 'pending', filename: input.filename, mime_type: input.mime_type ?? null, size_bytes: input.size_bytes ?? null, storage_key: input.storage_key ?? null, public_url: input.public_url ?? null, metadata: input.metadata ?? null }).select().single<Asset>();
  if (error !== null) return repoErr('ASSET_CREATE_FAILED', 'Failed to create asset in streams.assets', error.message);
  return repoOk(data);
}
export async function listAssetsByProjectId(projectId: string): Promise<RepositoryResult<Asset[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).select().eq('project_id', projectId).order('created_at', { ascending: false }).returns<Asset[]>();
  if (error !== null) return repoErr('ASSETS_LIST_FAILED', 'Failed to list assets from streams.assets', error.message);
  return repoOk(data);
}
