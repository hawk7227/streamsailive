-- STREAMS AI production foundation
-- Source of truth: STREAMS AI Chat must attach to main streamsailive auth, DB,
-- storage, credit ledger, job system, provider-run tracking, and history.

create schema if not exists streams_ai;

create extension if not exists pgcrypto;

create table if not exists streams_ai.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Personal workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams_ai.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists streams_ai.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  name text not null default 'Default project',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams_ai.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  product_id text not null,
  status text not null default 'active',
  plan_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, product_id)
);

create table if not exists streams_ai.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  project_id uuid references streams_ai.projects(id) on delete set null,
  workspace_id text not null default 'streams-ai',
  module_id text not null default 'streams-ai-core',
  product_id text not null default 'streams-ai',
  title text not null default 'New STREAMS AI chat',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams_ai.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  project_id uuid references streams_ai.projects(id) on delete set null,
  session_id uuid not null references streams_ai.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  status text not null default 'complete',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams_ai.chat_tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  project_id uuid references streams_ai.projects(id) on delete set null,
  session_id uuid not null references streams_ai.chat_sessions(id) on delete cascade,
  message_id uuid references streams_ai.chat_messages(id) on delete set null,
  tool_name text not null,
  product_id text,
  status text not null default 'queued',
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams_ai.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  project_id uuid references streams_ai.projects(id) on delete set null,
  session_id uuid references streams_ai.chat_sessions(id) on delete set null,
  message_id uuid references streams_ai.chat_messages(id) on delete set null,
  workspace_id text not null default 'streams-ai',
  module_id text not null default 'streams-ai-core',
  product_id text,
  kind text not null default 'file',
  name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  storage_bucket text,
  storage_path text,
  public_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams_ai.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  project_id uuid references streams_ai.projects(id) on delete set null,
  session_id uuid references streams_ai.chat_sessions(id) on delete set null,
  message_id uuid references streams_ai.chat_messages(id) on delete set null,
  tool_call_id uuid references streams_ai.chat_tool_calls(id) on delete set null,
  workspace_id text not null default 'streams-ai',
  module_id text not null default 'streams-ai-core',
  product_id text,
  status text not null default 'queued',
  kind text not null default 'chat',
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb,
  error text,
  credit_estimate numeric not null default 0,
  credit_cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams_ai.job_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  job_id uuid not null references streams_ai.jobs(id) on delete cascade,
  event_type text not null,
  message text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams_ai.provider_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  job_id uuid references streams_ai.jobs(id) on delete set null,
  provider text not null,
  model text,
  status text not null default 'queued',
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb,
  output_asset_id uuid references streams_ai.assets(id) on delete set null,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists streams_ai.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  amount numeric not null,
  balance_after numeric,
  source text not null default 'system',
  reason text,
  related_job_id uuid references streams_ai.jobs(id) on delete set null,
  related_session_id uuid references streams_ai.chat_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams_ai.usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams_ai.tenants(id) on delete cascade,
  user_id uuid not null,
  session_id uuid references streams_ai.chat_sessions(id) on delete set null,
  job_id uuid references streams_ai.jobs(id) on delete set null,
  provider_run_id uuid references streams_ai.provider_runs(id) on delete set null,
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  media_seconds numeric not null default 0,
  credit_cost numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists streams_ai_memberships_user_idx on streams_ai.memberships(user_id);
create index if not exists streams_ai_projects_owner_idx on streams_ai.projects(tenant_id, user_id);
create index if not exists streams_ai_entitlements_owner_idx on streams_ai.product_entitlements(tenant_id, user_id, product_id);
create index if not exists streams_ai_sessions_owner_idx on streams_ai.chat_sessions(tenant_id, user_id, updated_at desc);
create index if not exists streams_ai_messages_session_idx on streams_ai.chat_messages(tenant_id, user_id, session_id, created_at asc);
create index if not exists streams_ai_assets_owner_idx on streams_ai.assets(tenant_id, user_id, project_id, session_id, created_at desc);
create index if not exists streams_ai_jobs_owner_idx on streams_ai.jobs(tenant_id, user_id, status, created_at desc);
create index if not exists streams_ai_job_events_job_idx on streams_ai.job_events(tenant_id, user_id, job_id, created_at asc);
create index if not exists streams_ai_credit_owner_idx on streams_ai.credit_ledger(tenant_id, user_id, created_at desc);
create index if not exists streams_ai_usage_owner_idx on streams_ai.usage_events(tenant_id, user_id, created_at desc);

alter table streams_ai.tenants enable row level security;
alter table streams_ai.memberships enable row level security;
alter table streams_ai.projects enable row level security;
alter table streams_ai.product_entitlements enable row level security;
alter table streams_ai.chat_sessions enable row level security;
alter table streams_ai.chat_messages enable row level security;
alter table streams_ai.chat_tool_calls enable row level security;
alter table streams_ai.assets enable row level security;
alter table streams_ai.jobs enable row level security;
alter table streams_ai.job_events enable row level security;
alter table streams_ai.provider_runs enable row level security;
alter table streams_ai.credit_ledger enable row level security;
alter table streams_ai.usage_events enable row level security;

-- Access is intended through trusted server routes/repositories with service-role credentials.
-- No permissive client policies are created here.
