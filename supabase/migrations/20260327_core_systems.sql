-- ── PHASE 1: Core Systems Schema ─────────────────────────────────────────────
-- Run in Supabase SQL Editor. Safe to run multiple times (IF NOT EXISTS throughout).

-- ── 1. files ─────────────────────────────────────────────────────────────────
create table if not exists files (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  mime_type      text not null default 'application/octet-stream',
  size           bigint not null default 0,
  hash           text,                          -- sha256 hex for dedupe
  bucket         text not null default 'files',
  storage_path   text not null,
  public_url     text,
  is_temp        boolean not null default true, -- temp until moved to permanent
  extracted_text text,                          -- parsed content
  metadata       jsonb default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_files_workspace on files(workspace_id, created_at desc);
create index if not exists idx_files_hash      on files(hash) where hash is not null;
create index if not exists idx_files_temp      on files(is_temp, created_at) where is_temp = true;

alter table files enable row level security;
create policy if not exists "users own files"
  on files for all using (user_id = auth.uid());

-- ── 2. file_chunks ───────────────────────────────────────────────────────────
create table if not exists file_chunks (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references files(id) on delete cascade,
  chunk_index integer not null,
  content     text not null,
  token_count integer not null default 0,
  search_vec  tsvector generated always as (to_tsvector('english', content)) stored,
  created_at  timestamptz not null default now()
);

create index if not exists idx_file_chunks_file    on file_chunks(file_id, chunk_index);
create index if not exists idx_file_chunks_search  on file_chunks using gin(search_vec);

alter table file_chunks enable row level security;
create policy if not exists "users own file chunks"
  on file_chunks for all using (
    file_id in (select id from files where user_id = auth.uid())
  );

-- ── 3. pipeline_jobs ─────────────────────────────────────────────────────────
create table if not exists pipeline_jobs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null,                   -- image_gen, video_gen, t2v, i2v, tts, stt, song, parse_file
  status       text not null default 'pending'  -- pending, claimed, running, completed, failed, cancelled
               check (status in ('pending','claimed','running','completed','failed','cancelled')),
  priority     integer not null default 5,      -- 1=highest 10=lowest
  payload      jsonb not null default '{}'::jsonb,
  result       jsonb,
  error        text,
  retries      integer not null default 0,
  max_retries  integer not null default 3,
  claimed_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_jobs_pending   on pipeline_jobs(status, priority, created_at) where status = 'pending';
create index if not exists idx_jobs_workspace on pipeline_jobs(workspace_id, created_at desc);
create index if not exists idx_jobs_user      on pipeline_jobs(user_id, status);

alter table pipeline_jobs enable row level security;
create policy if not exists "users own jobs"
  on pipeline_jobs for all using (user_id = auth.uid());

-- ── 4. pipeline_steps ────────────────────────────────────────────────────────
create table if not exists pipeline_steps (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references pipeline_jobs(id) on delete cascade,
  step_name    text not null,
  status       text not null default 'pending'
               check (status in ('pending','running','completed','failed','skipped')),
  input        jsonb default '{}'::jsonb,
  output       jsonb,
  error        text,
  duration_ms  integer,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_steps_job on pipeline_steps(job_id, created_at);

alter table pipeline_steps enable row level security;
create policy if not exists "users own steps"
  on pipeline_steps for all using (
    job_id in (select id from pipeline_jobs where user_id = auth.uid())
  );

-- ── 5. voice_datasets ────────────────────────────────────────────────────────
create table if not exists voice_datasets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  file_id         uuid references files(id) on delete set null,
  storage_path    text,
  duration_secs   numeric,
  sample_rate     integer,
  channels        integer,
  format          text,
  quality_score   numeric,                      -- 0-100
  noise_level     numeric,                      -- 0-100 (lower = better)
  segment_count   integer default 0,
  status          text not null default 'pending'
                  check (status in ('pending','processing','ready','failed','rejected')),
  validation_log  jsonb default '[]'::jsonb,
  elevenlabs_id   text,                         -- if synced to ElevenLabs
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_voice_datasets_workspace on voice_datasets(workspace_id);

alter table voice_datasets enable row level security;
create policy if not exists "users own voice datasets"
  on voice_datasets for all using (user_id = auth.uid());

-- ── 6. media_assets ──────────────────────────────────────────────────────────
create table if not exists media_assets (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null,
  user_id               uuid not null references auth.users(id) on delete cascade,
  type                  text not null
                        check (type in ('image','video','audio','document','voice_sample')),
  url                   text not null,
  thumbnail_url         text,
  name                  text,
  mime_type             text,
  size                  bigint,
  duration_secs         numeric,
  width                 integer,
  height                integer,
  metadata              jsonb default '{}'::jsonb,
  source_generation_id  uuid,                   -- links to generations table
  source_file_id        uuid references files(id) on delete set null,
  tags                  text[] default '{}',
  favorited             boolean default false,
  created_at            timestamptz not null default now()
);

create index if not exists idx_media_assets_workspace on media_assets(workspace_id, type, created_at desc);
create index if not exists idx_media_assets_tags      on media_assets using gin(tags);

alter table media_assets enable row level security;
create policy if not exists "users own media assets"
  on media_assets for all using (user_id = auth.uid());

-- ── 7. ledger_logs ───────────────────────────────────────────────────────────
create table if not exists ledger_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null,                   -- generate_image, validate_copy, job_fail, rate_limit, etc.
  entity_type  text,                            -- generation, file, job, pipeline, voice
  entity_id    text,
  payload      jsonb default '{}'::jsonb,
  severity     text not null default 'info'
               check (severity in ('debug','info','warn','error','critical')),
  ip_address   text,
  user_agent   text,
  duration_ms  integer,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ledger_workspace  on ledger_logs(workspace_id, created_at desc);
create index if not exists idx_ledger_action     on ledger_logs(action, created_at desc);
create index if not exists idx_ledger_severity   on ledger_logs(severity, created_at desc) where severity in ('warn','error','critical');

-- Ledger is append-only — no RLS delete, admin reads all
alter table ledger_logs enable row level security;
create policy if not exists "users write own ledger"
  on ledger_logs for insert with check (user_id = auth.uid() or user_id is null);
create policy if not exists "users read own ledger"
  on ledger_logs for select using (user_id = auth.uid() or user_id is null);

-- ── 8. Storage buckets ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('files',          'files',          false, 104857600, null),   -- 100MB, all types, private
  ('voice-datasets', 'voice-datasets', false, 524288000, array['audio/wav','audio/mp3','audio/mpeg','audio/ogg','audio/flac','audio/aac']),  -- 500MB
  ('media-assets',   'media-assets',   true,  104857600, null)    -- 100MB, public
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role access to all buckets
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Service role files bucket') then
    create policy "Service role files bucket" on storage.objects for all to service_role using (bucket_id in ('files','voice-datasets','media-assets')) with check (bucket_id in ('files','voice-datasets','media-assets'));
  end if;
end $$;

-- ── 9. updated_at triggers ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'files_updated_at') then
    create trigger files_updated_at before update on files for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'jobs_updated_at') then
    create trigger jobs_updated_at before update on pipeline_jobs for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'voice_datasets_updated_at') then
    create trigger voice_datasets_updated_at before update on voice_datasets for each row execute function set_updated_at();
  end if;
end $$;
