create schema if not exists streams;

create table if not exists streams.video_editor_projects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  source_analysis_id uuid null references streams.reference_analyses(id) on delete set null,
  source_asset_id uuid null,
  title text not null default 'Untitled video editor project',
  status text not null default 'needs_worker',
  active_version_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_editor_tracks (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  track_type text not null,
  label text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_editor_segments (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  segment_type text not null,
  segment_index integer not null default 0,
  start_sec numeric null,
  end_sec numeric null,
  label text null,
  source_frame_asset_ids text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_editor_versions (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  parent_version_id uuid null references streams.video_editor_versions(id) on delete set null,
  source_asset_id uuid null,
  output_asset_id uuid null,
  status text not null default 'source',
  change_summary text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_editor_edit_instructions (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  version_id uuid null references streams.video_editor_versions(id) on delete set null,
  target_type text not null,
  target_id uuid null,
  instruction text not null,
  status text not null default 'blocked_worker_required',
  provider_run_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_worker_jobs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  project_id uuid null,
  status text not null default 'queued',
  stage text not null default 'queued',
  source_url text null,
  source_asset_id uuid null,
  requested_profile text not null default 'admin_full',
  worker_kind text not null default 'ffmpeg_local_or_durable_worker',
  attempts integer not null default 0,
  last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz null,
  completed_at timestamptz null
);

create index if not exists video_editor_projects_project_id_idx on streams.video_editor_projects(project_id);
create index if not exists video_editor_projects_source_analysis_id_idx on streams.video_editor_projects(source_analysis_id);
create index if not exists video_editor_tracks_project_idx on streams.video_editor_tracks(editor_project_id);
create index if not exists video_editor_segments_project_idx on streams.video_editor_segments(editor_project_id);
create index if not exists video_editor_versions_project_idx on streams.video_editor_versions(editor_project_id);
create index if not exists video_editor_edit_instructions_project_idx on streams.video_editor_edit_instructions(editor_project_id);
create index if not exists video_analysis_worker_jobs_analysis_id_idx on streams.video_analysis_worker_jobs(analysis_id);
create index if not exists video_analysis_worker_jobs_status_idx on streams.video_analysis_worker_jobs(status);

grant usage on schema streams to anon, authenticated, service_role;

grant select, insert, update, delete on table streams.video_editor_projects to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_tracks to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_segments to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_versions to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_edit_instructions to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_worker_jobs to anon, authenticated, service_role;

grant usage, select on all sequences in schema streams to anon, authenticated, service_role;

notify pgrst, 'reload schema';
