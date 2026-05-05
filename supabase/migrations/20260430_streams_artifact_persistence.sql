create table if not exists public.streams_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workspace_id text not null,
  title text not null default 'New conversation',
  active_tab text not null default 'chat',
  preview_artifact_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.streams_chat_sessions(id) on delete cascade,
  user_id text not null,
  workspace_id text not null,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null default '',
  artifact_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.streams_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workspace_id text not null,
  session_id uuid null references public.streams_chat_sessions(id) on delete set null,
  type text not null,
  subtype text null,
  title text not null,
  mime text null,
  preview_url text null,
  download_url text null,
  storage_path text null,
  source_tool text null,
  created_by_chat boolean not null default false,
  created_by_tab text null,
  version int not null default 1,
  status text not null default 'ready',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.streams_artifacts(id) on delete cascade,
  version int not null,
  content text null,
  preview_url text null,
  download_url text null,
  storage_path text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (artifact_id, version)
);

create table if not exists public.streams_preview_state (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workspace_id text not null,
  session_id uuid null references public.streams_chat_sessions(id) on delete cascade,
  artifact_id uuid null references public.streams_artifacts(id) on delete set null,
  placement text not null check (placement in ('inline','right_pane','tab','both','none')),
  active_tab text null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams_provider_capabilities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  media_type text not null,
  supports_exact_dimensions boolean not null default false,
  supports_bulk boolean not null default false,
  supports_img2img boolean not null default false,
  supports_inpaint boolean not null default false,
  supports_outpaint boolean not null default false,
  supports_upscale boolean not null default false,
  supported_aspect_ratios text[] not null default '{}',
  min_width int null,
  max_width int null,
  min_height int null,
  max_height int null,
  realism_tier int not null default 1,
  prompt_adherence_tier int not null default 1,
  speed_tier int not null default 1,
  cost_tier int not null default 1,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, model, media_type)
);

create table if not exists public.streams_quality_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null default 'default',
  minimum_quality_tier text not null default 'premium_realistic',
  minimum_realism_score numeric not null default 0.82,
  minimum_prompt_adherence_score numeric not null default 0.82,
  minimum_face_score numeric not null default 0.80,
  minimum_anatomy_score numeric not null default 0.78,
  minimum_composition_score numeric not null default 0.78,
  require_native_size_match boolean not null default true,
  allow_crop boolean not null default false,
  allow_fallback_below_floor boolean not null default false,
  max_retry_count int not null default 2,
  escalation_provider_order text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, name)
);

create table if not exists public.streams_quality_evaluations (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid null references public.streams_artifacts(id) on delete set null,
  generation_id text null,
  workspace_id text not null,
  provider text null,
  model text null,
  realism_score numeric null,
  prompt_adherence_score numeric null,
  face_score numeric null,
  anatomy_score numeric null,
  composition_score numeric null,
  size_compliance boolean null,
  passed boolean not null default false,
  decision text not null default 'unknown',
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists streams_chat_sessions_user_workspace_idx on public.streams_chat_sessions(user_id, workspace_id, updated_at desc);
create index if not exists streams_chat_messages_session_idx on public.streams_chat_messages(session_id, created_at asc);
create index if not exists streams_artifacts_workspace_idx on public.streams_artifacts(workspace_id, created_at desc);
create index if not exists streams_artifacts_session_idx on public.streams_artifacts(session_id, created_at desc);
create index if not exists streams_preview_state_session_idx on public.streams_preview_state(session_id, updated_at desc);
