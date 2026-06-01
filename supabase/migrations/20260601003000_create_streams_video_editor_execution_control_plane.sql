create schema if not exists streams;

create table if not exists streams.video_editor_provider_runs (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  version_id uuid null references streams.video_editor_versions(id) on delete set null,
  edit_instruction_id uuid null references streams.video_editor_edit_instructions(id) on delete set null,
  provider text not null,
  action text not null,
  target_type text not null default 'project',
  target_id uuid null,
  status text not null default 'blocked_provider_not_wired',
  request jsonb not null default '{}'::jsonb,
  response jsonb null,
  output_asset_id uuid null,
  error text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz null,
  completed_at timestamptz null
);

create table if not exists streams.video_editor_transcript_edits (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  version_id uuid null references streams.video_editor_versions(id) on delete set null,
  segment_id uuid null references streams.video_editor_segments(id) on delete set null,
  start_sec numeric null,
  end_sec numeric null,
  original_text text null,
  edited_text text not null,
  speaker_id uuid null,
  status text not null default 'blocked_voice_lipsync_worker_required',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_editor_qc_reports (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  version_id uuid null references streams.video_editor_versions(id) on delete set null,
  provider_run_id uuid null references streams.video_editor_provider_runs(id) on delete set null,
  status text not null default 'pending',
  checks jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  passed boolean null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_editor_stitch_jobs (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  active_version_id uuid null references streams.video_editor_versions(id) on delete set null,
  status text not null default 'blocked_ffmpeg_worker_required',
  timeline_snapshot jsonb not null default '{}'::jsonb,
  output_asset_id uuid null,
  error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz null,
  completed_at timestamptz null
);

create table if not exists streams.video_editor_exports (
  id uuid primary key default gen_random_uuid(),
  editor_project_id uuid not null references streams.video_editor_projects(id) on delete cascade,
  stitch_job_id uuid null references streams.video_editor_stitch_jobs(id) on delete set null,
  version_id uuid null references streams.video_editor_versions(id) on delete set null,
  export_type text not null default 'mp4',
  status text not null default 'blocked_render_worker_required',
  output_url text null,
  output_asset_id uuid null,
  settings jsonb not null default '{}'::jsonb,
  error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz null
);

create index if not exists video_editor_provider_runs_project_idx on streams.video_editor_provider_runs(editor_project_id);
create index if not exists video_editor_provider_runs_status_idx on streams.video_editor_provider_runs(status);
create index if not exists video_editor_transcript_edits_project_idx on streams.video_editor_transcript_edits(editor_project_id);
create index if not exists video_editor_qc_reports_project_idx on streams.video_editor_qc_reports(editor_project_id);
create index if not exists video_editor_stitch_jobs_project_idx on streams.video_editor_stitch_jobs(editor_project_id);
create index if not exists video_editor_exports_project_idx on streams.video_editor_exports(editor_project_id);

grant usage on schema streams to anon, authenticated, service_role;

grant select, insert, update, delete on table streams.video_editor_provider_runs to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_transcript_edits to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_qc_reports to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_stitch_jobs to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_editor_exports to anon, authenticated, service_role;

grant usage, select on all sequences in schema streams to anon, authenticated, service_role;

notify pgrst, 'reload schema';
