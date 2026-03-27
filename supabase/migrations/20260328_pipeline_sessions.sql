-- ── pipeline_sessions ──────────────────────────────────────────────────────
-- Stores pipeline workspace session state: step states, outputs, niche, concepts.
-- Used by /api/pipeline/session and the pipeline/test workspace.

create table if not exists pipeline_sessions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null,
  niche_id            text,
  selected_concept_id text,
  prompts             jsonb not null default '{}'::jsonb,
  step_states         jsonb not null default '{}'::jsonb,
  outputs             jsonb not null default '{}'::jsonb,
  pipeline_status     text not null default 'idle'
                      check (pipeline_status in ('idle','running','completed','failed')),
  current_step_id     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_pipeline_sessions_workspace
  on pipeline_sessions(workspace_id, created_at desc);

alter table pipeline_sessions enable row level security;

-- Workspace members can access sessions in their workspace
create policy if not exists "workspace members own pipeline sessions"
  on pipeline_sessions for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

-- Auto-update updated_at on every change
create or replace function update_pipeline_sessions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pipeline_sessions_updated_at on pipeline_sessions;
create trigger pipeline_sessions_updated_at
  before update on pipeline_sessions
  for each row execute function update_pipeline_sessions_updated_at();
