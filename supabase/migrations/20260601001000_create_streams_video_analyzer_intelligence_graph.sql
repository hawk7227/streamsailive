create schema if not exists streams;

create table if not exists streams.video_analysis_assets (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  asset_kind text not null,
  asset_url text null,
  storage_bucket text null,
  storage_path text null,
  start_sec numeric null,
  end_sec numeric null,
  mime_type text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_segments (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  segment_type text not null,
  segment_index integer not null default 0,
  start_sec numeric null,
  end_sec numeric null,
  label text null,
  transcript text null,
  frame_asset_ids text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_subjects (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  subject_index integer not null default 0,
  subject_type text not null default 'person',
  display_name text null,
  face_asset_id text null,
  appearance_description text null,
  clothing_description text null,
  identity_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_speakers (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  speaker_index integer not null default 0,
  display_name text null,
  voice_asset_id text null,
  voice_profile jsonb not null default '{}'::jsonb,
  speaking_segments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_motion_profiles (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  target_type text not null default 'project',
  target_id uuid null,
  motion_profile jsonb not null default '{}'::jsonb,
  camera_motion_profile jsonb not null default '{}'::jsonb,
  gesture_profile jsonb not null default '{}'::jsonb,
  expression_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_quality_reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  status text not null default 'pending',
  report jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_media_graphs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  graph jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists streams.video_analysis_worker_events (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references streams.reference_analyses(id) on delete cascade,
  event_type text not null,
  status text null,
  message text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists video_analysis_assets_analysis_id_idx on streams.video_analysis_assets(analysis_id);
create index if not exists video_analysis_segments_analysis_id_idx on streams.video_analysis_segments(analysis_id);
create index if not exists video_analysis_subjects_analysis_id_idx on streams.video_analysis_subjects(analysis_id);
create index if not exists video_analysis_speakers_analysis_id_idx on streams.video_analysis_speakers(analysis_id);
create index if not exists video_analysis_motion_profiles_analysis_id_idx on streams.video_analysis_motion_profiles(analysis_id);
create index if not exists video_analysis_quality_reports_analysis_id_idx on streams.video_analysis_quality_reports(analysis_id);
create index if not exists video_analysis_media_graphs_analysis_id_idx on streams.video_analysis_media_graphs(analysis_id);
create index if not exists video_analysis_worker_events_analysis_id_idx on streams.video_analysis_worker_events(analysis_id);

grant usage on schema streams to anon, authenticated, service_role;

grant select, insert, update, delete on table streams.video_analysis_assets to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_segments to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_subjects to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_speakers to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_motion_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_quality_reports to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_media_graphs to anon, authenticated, service_role;
grant select, insert, update, delete on table streams.video_analysis_worker_events to anon, authenticated, service_role;

grant usage, select on all sequences in schema streams to anon, authenticated, service_role;

notify pgrst, 'reload schema';
