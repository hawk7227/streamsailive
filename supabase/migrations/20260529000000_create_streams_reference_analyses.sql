create schema if not exists streams;

create table if not exists streams.reference_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  job_id uuid null,
  source_type text not null,
  source_url text null,
  source_asset_id uuid null,
  status text not null default 'queued',
  blueprint jsonb null,
  transcript text null,
  summary text null,
  error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists reference_analyses_project_id_idx
  on streams.reference_analyses(project_id);

create index if not exists reference_analyses_status_idx
  on streams.reference_analyses(status);

create index if not exists reference_analyses_source_asset_id_idx
  on streams.reference_analyses(source_asset_id);
