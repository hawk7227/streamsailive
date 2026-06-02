create extension if not exists "pgcrypto";

create table if not exists public.admingeneration_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  source_type text not null default 'unknown',
  source_url text,
  status text not null default 'created',
  intelligence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admingeneration_editor_projects (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.admingeneration_analyses(id) on delete set null,
  title text not null default 'Untitled editor project',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admingeneration_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  analysis_id uuid references public.admingeneration_analyses(id) on delete set null,
  asset_kind text not null,
  asset_url text,
  storage_path text,
  mime_type text,
  duration_sec numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_timeline_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  analysis_id uuid references public.admingeneration_analyses(id) on delete set null,
  segment_kind text not null default 'clip',
  label text,
  start_sec numeric not null default 0,
  end_sec numeric not null default 0,
  frame_start integer,
  frame_end integer,
  source_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_speakers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  label text not null default 'Speaker',
  voice_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_transcript_words (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  segment_id uuid references public.admingeneration_timeline_segments(id) on delete cascade,
  speaker_id uuid references public.admingeneration_speakers(id) on delete set null,
  word text not null,
  start_sec numeric not null default 0,
  end_sec numeric not null default 0,
  frame_start integer,
  frame_end integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_subject_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  label text not null default 'Subject',
  face_reference_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  body_reference_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  appearance_description text,
  clothing_description text,
  voice_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_motion_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  subject_id uuid references public.admingeneration_subject_profiles(id) on delete cascade,
  segment_id uuid references public.admingeneration_timeline_segments(id) on delete cascade,
  motion_kind text not null default 'motion',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_object_masks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  segment_id uuid references public.admingeneration_timeline_segments(id) on delete cascade,
  label text not null default 'Object',
  object_id text,
  mask_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  depth_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_provider_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  version_id uuid,
  provider text not null,
  action text not null,
  status text not null default 'queued',
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  output_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admingeneration_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  parent_version_id uuid references public.admingeneration_versions(id) on delete set null,
  status text not null default 'draft',
  change_summary text,
  provider_run_id uuid references public.admingeneration_provider_runs(id) on delete set null,
  output_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admingeneration_provider_runs
  drop constraint if exists admingeneration_provider_runs_version_id_fkey;

alter table public.admingeneration_provider_runs
  add constraint admingeneration_provider_runs_version_id_fkey
  foreign key (version_id) references public.admingeneration_versions(id) on delete set null;

create table if not exists public.admingeneration_edit_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  target_type text not null,
  target_id text,
  action text not null,
  instruction text,
  status text not null default 'queued',
  provider_run_id uuid references public.admingeneration_provider_runs(id) on delete set null,
  version_id uuid references public.admingeneration_versions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admingeneration_qc_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  version_id uuid references public.admingeneration_versions(id) on delete cascade,
  status text not null default 'needs_check',
  checks jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_stitch_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  status text not null default 'queued',
  clip_asset_ids uuid[] not null default '{}',
  request jsonb not null default '{}'::jsonb,
  output_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admingeneration_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  stitch_job_id uuid references public.admingeneration_stitch_jobs(id) on delete set null,
  status text not null default 'queued',
  export_type text not null default 'mp4',
  output_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  output_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admingeneration_long_video_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  status text not null default 'planned',
  prompt text,
  target_duration_sec numeric not null default 60,
  max_shot_duration_sec numeric not null default 8,
  identity_lock boolean not null default true,
  stitch_required boolean not null default true,
  qa_required boolean not null default true,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admingeneration_long_video_shots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.admingeneration_long_video_plans(id) on delete cascade,
  project_id uuid references public.admingeneration_editor_projects(id) on delete cascade,
  scene_id text,
  shot_index integer not null,
  prompt text not null,
  provider_intent text not null default 'provider_router',
  status text not null default 'planned',
  start_sec numeric not null default 0,
  end_sec numeric not null default 0,
  provider_run_id uuid references public.admingeneration_provider_runs(id) on delete set null,
  output_asset_id uuid references public.admingeneration_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adm_assets_project on public.admingeneration_assets(project_id);
create index if not exists idx_adm_segments_project on public.admingeneration_timeline_segments(project_id);
create index if not exists idx_adm_words_project on public.admingeneration_transcript_words(project_id);
create index if not exists idx_adm_versions_project on public.admingeneration_versions(project_id);
create index if not exists idx_adm_provider_runs_project on public.admingeneration_provider_runs(project_id);
create index if not exists idx_adm_long_video_shots_plan on public.admingeneration_long_video_shots(plan_id);
