-- Authoritative conversation/runtime operation ledger.
create schema if not exists streams;
create extension if not exists pgcrypto;

create table if not exists streams.streams_ai_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  session_id uuid not null references streams.streams_ai_chat_sessions(id) on delete cascade,
  turn_id uuid not null,
  intent text not null,
  stage text not null default 'RECEIVED',
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  idempotency_key text not null,
  parent_operation_id uuid references streams.streams_ai_operations(id) on delete set null,
  project_id uuid references streams.streams_ai_projects(id) on delete set null,
  preview_id uuid,
  preview_url text,
  artifacts jsonb not null default '[]'::jsonb,
  failure jsonb,
  metadata jsonb not null default '{}'::jsonb,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  retry_count integer not null default 0,
  retry_budget integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, idempotency_key)
);
create index if not exists streams_ai_operations_session_idx on streams.streams_ai_operations(tenant_id,user_id,session_id,created_at desc);
create index if not exists streams_ai_operations_stalled_idx on streams.streams_ai_operations(status,heartbeat_at) where status='running';

create table if not exists streams.streams_ai_operation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  operation_id uuid not null references streams.streams_ai_operations(id) on delete cascade,
  event_type text not null,
  stage text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists streams_ai_operation_events_operation_idx on streams.streams_ai_operation_events(operation_id,created_at);

alter table streams.streams_ai_operations enable row level security;
alter table streams.streams_ai_operation_events enable row level security;
