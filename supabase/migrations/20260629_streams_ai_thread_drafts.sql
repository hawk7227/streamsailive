create schema if not exists streams;

create table if not exists streams.streams_ai_thread_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  project_id uuid null,
  session_id text not null,
  draft text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, session_id)
);

create index if not exists streams_ai_thread_drafts_user_idx
  on streams.streams_ai_thread_drafts (tenant_id, user_id, updated_at desc);

create index if not exists streams_ai_thread_drafts_session_idx
  on streams.streams_ai_thread_drafts (tenant_id, user_id, session_id);

create or replace function streams.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists streams_ai_thread_drafts_set_updated_at
  on streams.streams_ai_thread_drafts;

create trigger streams_ai_thread_drafts_set_updated_at
before update on streams.streams_ai_thread_drafts
for each row
execute function streams.set_updated_at();

alter table streams.streams_ai_thread_drafts enable row level security;
