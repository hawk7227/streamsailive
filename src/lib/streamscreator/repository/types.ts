// streams.* real column shapes

export interface Project {
  id: string;
  name: string;
  mode: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface CreateProjectInput {
  name: string;
  mode?: string;
  status?: string;
}

export interface Job {
  id: string;
  project_id: string;
  type: string;
  phase: string | null;
  progress: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
export interface CreateJobInput {
  project_id: string;
  type: string;
  phase?: string;
  progress?: number;
}

export interface Asset {
  id: string;
  project_id: string;
  type: string;
  storage_key: string | null;
  mime_type: string | null;
  provider: string | null;
  status: string;
  created_at: string;
}
export interface CreateAssetInput {
  project_id: string;
  type: string;
  storage_key?: string;
  mime_type?: string;
  provider?: string;
  status?: string;
}

export interface ProviderRun {
  id: string;
  job_id: string;
  provider: string;
  request_ref: string | null;
  response_ref: string | null;
  output_asset_id: string | null;
  status: string;
  created_at: string;
}
export interface CreateProviderRunInput {
  job_id: string;
  provider: string;
  request_ref?: string;
  response_ref?: string;
  status?: string;
}

export type RepositoryResult<T> = { data: T; error: null } | { data: null; error: RepositoryError };
export interface RepositoryError { code: string; message: string; detail?: string; }
export function repoOk<T>(data: T): RepositoryResult<T> { return { data, error: null }; }
export function repoErr(code: string, message: string, detail?: string): RepositoryResult<never> { return { data: null, error: { code, message, detail } }; }
