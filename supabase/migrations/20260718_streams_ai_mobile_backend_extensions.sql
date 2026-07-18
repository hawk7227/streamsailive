-- StreamsAI mobile backend extensions.
-- Reuses existing Streams tenants, projects, assets, jobs/events, settings, entitlements,
-- usage notifications, and service-role repository model.

create schema if not exists streams;
create extension if not exists pgcrypto;

create table if not exists streams.streams_ai_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  installation_id text not null,
  platform text not null check (platform in ('ios','android','web')),
  device_name text,
  app_version text,
  os_version text,
  locale text,
  timezone text,
  push_provider text check (push_provider is null or push_provider in ('apns','fcm','webpush')),
  push_token text,
  push_token_updated_at timestamptz,
  status text not null default 'active' check (status in ('active','revoked','inactive')),
  refresh_token_family_id text,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, installation_id)
);

create table if not exists streams.streams_ai_device_security_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  device_id uuid references streams.streams_ai_devices(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  ip_address inet,
  user_agent text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams.streams_ai_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  channel text not null check (channel in ('push','email','in_app')),
  event_type text not null default '*',
  enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, channel, event_type)
);

create table if not exists streams.streams_ai_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  device_id uuid references streams.streams_ai_devices(id) on delete set null,
  job_id uuid references streams.streams_ai_jobs(id) on delete set null,
  event_id uuid references streams.streams_ai_job_events(id) on delete set null,
  notification_id uuid,
  provider text not null check (provider in ('apns','fcm','webpush')),
  event_type text not null,
  title text not null,
  body text not null,
  deep_link text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sending','delivered','failed','suppressed')),
  attempt_count integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  receipt_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams.streams_ai_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  project_id uuid references streams.streams_ai_projects(id) on delete set null,
  session_id uuid references streams.streams_ai_chat_sessions(id) on delete set null,
  device_id uuid references streams.streams_ai_devices(id) on delete set null,
  idempotency_key text not null,
  file_name text not null,
  mime_type text,
  total_bytes bigint not null check (total_bytes > 0),
  chunk_size integer not null check (chunk_size >= 65536 and chunk_size <= 16777216),
  total_chunks integer not null check (total_chunks > 0),
  confirmed_bytes bigint not null default 0,
  confirmed_chunks integer not null default 0,
  storage_bucket text not null default 'streams-ai-assets',
  storage_prefix text not null,
  status text not null default 'created' check (status in ('created','uploading','completing','completed','cancelled','failed','expired')),
  checksum_algorithm text not null default 'sha256',
  expected_checksum text,
  asset_id uuid references streams.streams_ai_assets(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, idempotency_key)
);

create table if not exists streams.streams_ai_upload_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  upload_session_id uuid not null references streams.streams_ai_upload_sessions(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  byte_offset bigint not null check (byte_offset >= 0),
  size_bytes integer not null check (size_bytes > 0),
  checksum text,
  storage_path text not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','invalid')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, upload_session_id, chunk_index)
);

create table if not exists streams.streams_ai_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid,
  feature_key text not null,
  platform text not null default '*' check (platform in ('*','web','ios','android')),
  min_app_version text,
  max_app_version text,
  plan_id text,
  region text,
  device_id uuid references streams.streams_ai_devices(id) on delete cascade,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  enabled boolean not null default true,
  kill_switch boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists streams_ai_feature_flags_scope_unique
  on streams.streams_ai_feature_flags (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    feature_key,
    platform,
    coalesce(plan_id, ''),
    coalesce(region, ''),
    coalesce(device_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists streams_ai_devices_owner_idx on streams.streams_ai_devices(tenant_id, user_id, status, last_active_at desc);
create index if not exists streams_ai_devices_push_idx on streams.streams_ai_devices(tenant_id, user_id, push_provider, status) where push_token is not null;
create index if not exists streams_ai_device_security_owner_idx on streams.streams_ai_device_security_events(tenant_id, user_id, created_at desc);
create index if not exists streams_ai_push_delivery_owner_idx on streams.streams_ai_push_deliveries(tenant_id, user_id, status, created_at desc);
create index if not exists streams_ai_push_delivery_retry_idx on streams.streams_ai_push_deliveries(status, next_attempt_at) where status in ('queued','failed');
create index if not exists streams_ai_upload_sessions_owner_idx on streams.streams_ai_upload_sessions(tenant_id, user_id, status, updated_at desc);
create index if not exists streams_ai_upload_chunks_session_idx on streams.streams_ai_upload_chunks(tenant_id, user_id, upload_session_id, chunk_index);
create index if not exists streams_ai_feature_flags_lookup_idx on streams.streams_ai_feature_flags(feature_key, platform, enabled, kill_switch, starts_at, ends_at);

alter table streams.streams_ai_devices enable row level security;
alter table streams.streams_ai_device_security_events enable row level security;
alter table streams.streams_ai_notification_preferences enable row level security;
alter table streams.streams_ai_push_deliveries enable row level security;
alter table streams.streams_ai_upload_sessions enable row level security;
alter table streams.streams_ai_upload_chunks enable row level security;
alter table streams.streams_ai_feature_flags enable row level security;

-- Access remains through trusted Streams server routes and service-role repositories.
