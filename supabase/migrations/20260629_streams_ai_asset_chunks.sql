create schema if not exists streams;

create table if not exists streams.streams_ai_asset_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  project_id uuid null,
  session_id text null,
  asset_id uuid not null,
  chunk_index integer not null default 0,
  content text not null,
  summary text null,
  token_estimate integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, asset_id, chunk_index)
);

create index if not exists streams_ai_asset_chunks_session_idx
  on streams.streams_ai_asset_chunks (tenant_id, user_id, session_id, created_at desc);

create index if not exists streams_ai_asset_chunks_asset_idx
  on streams.streams_ai_asset_chunks (tenant_id, user_id, asset_id, chunk_index);

create index if not exists streams_ai_asset_chunks_content_idx
  on streams.streams_ai_asset_chunks using gin (to_tsvector('english', content));

alter table streams.streams_ai_asset_chunks enable row level security;
