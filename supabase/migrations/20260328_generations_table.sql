-- ── generations ──────────────────────────────────────────────────────────────
-- AI generation records: images, videos, scripts, voice, i2v.
-- Used by /api/generations, /api/generations/[id], pipeline/test, operator dashboard.
-- NOTE: This table may already exist in production Supabase from earlier builds.
-- This migration uses IF NOT EXISTS / IF NOT EXISTS on all objects — safe to re-run.

create table if not exists generations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  workspace_id     uuid not null,
  type             text not null
                   check (type in ('image','video','script','voice','i2v')),
  prompt           text not null default '',
  title            text,
  status           text not null default 'pending'
                   check (status in ('pending','processing','completed','failed','cancelled')),
  aspect_ratio     text,
  duration         text,
  quality          text,
  style            text,
  output_url       text,
  external_id      text,           -- provider job ID (e.g. Kling video ID)
  progress         integer default 0,
  is_preview       boolean not null default false,
  favorited        boolean not null default false,
  concept_id       text,           -- links to concept slot (c1/c2/c3)
  session_id       text,           -- pipeline session ID
  provider         text,           -- openai | kling | runway | fal | veo3
  mode             text default 'standard',
  cost_estimate    numeric(10,4),
  generation_error text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists idx_generations_workspace
  on generations(workspace_id, created_at desc);
create index if not exists idx_generations_user
  on generations(user_id, created_at desc);
create index if not exists idx_generations_status
  on generations(status) where status in ('pending','processing');
create index if not exists idx_generations_external
  on generations(external_id) where external_id is not null;
create index if not exists idx_generations_concept
  on generations(concept_id) where concept_id is not null;

-- RLS
alter table generations enable row level security;

create policy if not exists "users own generations"
  on generations for all
  using (user_id = auth.uid());

-- Service role can update status/output_url from webhook handlers
create policy if not exists "service role full access to generations"
  on generations for all
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function update_generations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists generations_updated_at on generations;
create trigger generations_updated_at
  before update on generations
  for each row execute function update_generations_updated_at();
