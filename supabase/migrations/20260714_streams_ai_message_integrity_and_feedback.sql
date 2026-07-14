-- Production integrity for STREAMS AI chat turns and message actions.
-- Safe for repeated deployment and designed for tenant/user scoped lookups.

alter table streams.streams_ai_chat_messages
  add column if not exists turn_id uuid,
  add column if not exists idempotency_key text;

-- PostgreSQL unique indexes allow multiple NULL values, so this supports
-- ordinary messages while remaining directly usable by ON CONFLICT upserts.
create unique index if not exists streams_ai_messages_idempotency_unique
  on streams.streams_ai_chat_messages (tenant_id, user_id, idempotency_key);

create index if not exists streams_ai_messages_turn_idx
  on streams.streams_ai_chat_messages (tenant_id, user_id, session_id, turn_id, created_at asc)
  where turn_id is not null;

create table if not exists streams.streams_ai_message_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  session_id uuid not null references streams.streams_ai_chat_sessions(id) on delete cascade,
  message_id uuid not null references streams.streams_ai_chat_messages(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, message_id)
);

create index if not exists streams_ai_message_feedback_session_idx
  on streams.streams_ai_message_feedback (tenant_id, user_id, session_id, updated_at desc);

create table if not exists streams.streams_ai_message_action_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  session_id uuid references streams.streams_ai_chat_sessions(id) on delete cascade,
  message_id uuid references streams.streams_ai_chat_messages(id) on delete cascade,
  action text not null,
  idempotency_key text not null,
  status text not null default 'completed' check (status in ('started','completed','failed')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, idempotency_key)
);

create index if not exists streams_ai_message_action_receipts_session_idx
  on streams.streams_ai_message_action_receipts (tenant_id, user_id, session_id, created_at desc);

alter table streams.streams_ai_message_feedback enable row level security;
alter table streams.streams_ai_message_action_receipts enable row level security;

-- Access remains server-only through service-role repositories.
