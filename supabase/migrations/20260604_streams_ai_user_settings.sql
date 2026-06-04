-- STREAMS AI account settings persistence.
-- Stores user-facing settings by tenant/user/category/key. Access remains through trusted server routes.

create schema if not exists streams;
create extension if not exists pgcrypto;

create table if not exists streams.streams_ai_user_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  category text not null,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, category, setting_key)
);

create index if not exists streams_ai_user_settings_owner_idx
  on streams.streams_ai_user_settings(tenant_id, user_id, category, setting_key);

alter table streams.streams_ai_user_settings enable row level security;

-- Access is intended through trusted server routes/repositories with service-role credentials.
-- No permissive client policies are created here.
