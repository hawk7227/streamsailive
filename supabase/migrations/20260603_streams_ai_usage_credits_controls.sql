-- STREAMS AI usage credits, included limits, spend controls, and account usage surfaces.
-- This extends the existing streams schema without replacing the current chat/runtime tables.

create schema if not exists streams;
create extension if not exists pgcrypto;

create table if not exists streams.streams_ai_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  plan_id text not null default 'free_builder',
  status text not null default 'active',
  billing_provider text,
  billing_customer_id text,
  billing_subscription_id text,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, plan_id)
);

create table if not exists streams.streams_ai_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  plan_id text not null default 'free_builder',
  account_status text not null default 'active',
  payment_method_status text not null default 'missing',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists streams.streams_ai_usage_wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  plan_id text not null default 'free_builder',
  included_monthly_granted numeric not null default 0,
  included_monthly_used numeric not null default 0,
  included_monthly_available numeric not null default 0,
  paid_credits_received numeric not null default 0,
  paid_credits_used numeric not null default 0,
  paid_credits_available numeric not null default 0,
  welcome_credits_granted numeric not null default 0,
  welcome_credits_expires_at timestamptz,
  current_month_key text not null default to_char(now(), 'YYYY-MM'),
  monthly_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists streams.streams_ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  ledger_type text not null,
  amount numeric not null default 0,
  balance_after numeric,
  feature_key text,
  stage text,
  action_status text,
  reason text,
  related_job_id uuid references streams.streams_ai_jobs(id) on delete set null,
  related_session_id uuid references streams.streams_ai_chat_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams.streams_ai_usage_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  session_key text not null,
  window_started_at timestamptz not null,
  reset_at timestamptz not null,
  included_limit numeric not null default 0,
  included_used numeric not null default 0,
  included_available numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, session_key)
);

create table if not exists streams.streams_ai_daily_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  usage_date date not null default current_date,
  daily_limit numeric not null default 0,
  daily_used numeric not null default 0,
  daily_available numeric not null default 0,
  operator_used numeric not null default 0,
  studio_used numeric not null default 0,
  video_used numeric not null default 0,
  launch_used numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, usage_date)
);

create table if not exists streams.streams_ai_usage_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  credits numeric not null,
  amount_usd numeric not null,
  status text not null default 'pending',
  checkout_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists streams.streams_ai_auto_reload_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  enabled boolean not null default false,
  threshold_usd numeric not null default 10,
  top_up_usd numeric not null default 50,
  status text not null default 'off',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists streams.streams_ai_spend_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  monthly_limit_usd numeric,
  current_month_spend_usd numeric not null default 0,
  current_month_key text not null default to_char(now(), 'YYYY-MM'),
  unlimited_allowed boolean not null default false,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists streams.streams_ai_usage_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  event_type text not null,
  title text not null,
  message text not null,
  action_href text,
  status text not null default 'unread',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists streams_ai_subscriptions_owner_idx on streams.streams_ai_subscriptions(tenant_id, user_id, status, created_at desc);
create index if not exists streams_ai_accounts_owner_idx on streams.streams_ai_accounts(tenant_id, user_id);
create index if not exists streams_ai_usage_wallets_owner_idx on streams.streams_ai_usage_wallets(tenant_id, user_id);
create index if not exists streams_ai_usage_ledger_owner_idx on streams.streams_ai_usage_ledger(tenant_id, user_id, created_at desc);
create index if not exists streams_ai_usage_sessions_owner_idx on streams.streams_ai_usage_sessions(tenant_id, user_id, reset_at desc);
create index if not exists streams_ai_daily_usage_owner_idx on streams.streams_ai_daily_usage(tenant_id, user_id, usage_date desc);
create index if not exists streams_ai_credit_purchases_owner_idx on streams.streams_ai_usage_credit_purchases(tenant_id, user_id, created_at desc);
create index if not exists streams_ai_auto_reload_owner_idx on streams.streams_ai_auto_reload_settings(tenant_id, user_id);
create index if not exists streams_ai_spend_limits_owner_idx on streams.streams_ai_spend_limits(tenant_id, user_id);
create index if not exists streams_ai_usage_notifications_owner_idx on streams.streams_ai_usage_notifications(tenant_id, user_id, created_at desc);

alter table streams.streams_ai_subscriptions enable row level security;
alter table streams.streams_ai_accounts enable row level security;
alter table streams.streams_ai_usage_wallets enable row level security;
alter table streams.streams_ai_usage_ledger enable row level security;
alter table streams.streams_ai_usage_sessions enable row level security;
alter table streams.streams_ai_daily_usage enable row level security;
alter table streams.streams_ai_usage_credit_purchases enable row level security;
alter table streams.streams_ai_auto_reload_settings enable row level security;
alter table streams.streams_ai_spend_limits enable row level security;
alter table streams.streams_ai_usage_notifications enable row level security;

-- Access is intended through trusted server routes/repositories with service-role credentials.
-- No permissive client policies are created here.
