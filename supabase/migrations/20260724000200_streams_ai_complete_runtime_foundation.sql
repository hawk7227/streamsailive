create table if not exists streams.streams_ai_conversation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  session_id uuid not null references streams.streams_ai_chat_sessions(id) on delete cascade,
  branch_id uuid,
  message_id uuid,
  operation_id uuid references streams.streams_ai_operations(id) on delete set null,
  event_type text not null,
  role text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  client_request_id text,
  server_request_id text,
  parent_event_id uuid references streams.streams_ai_conversation_events(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists streams_ai_conversation_events_session_idx on streams.streams_ai_conversation_events(tenant_id,user_id,session_id,created_at,id);
create index if not exists streams_ai_conversation_events_operation_idx on streams.streams_ai_conversation_events(operation_id,created_at);

create table if not exists streams.streams_ai_operation_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  operation_id uuid not null references streams.streams_ai_operations(id) on delete cascade,
  stage text not null,
  artifacts jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists streams_ai_operation_snapshots_operation_idx on streams.streams_ai_operation_snapshots(operation_id,created_at desc);

create table if not exists streams.streams_ai_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references streams.streams_ai_tenants(id) on delete cascade,
  user_id uuid not null,
  idempotency_key text not null,
  resource_type text not null,
  resource_id uuid,
  response jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tenant_id,user_id,idempotency_key)
);

alter table streams.streams_ai_conversation_events enable row level security;
alter table streams.streams_ai_operation_snapshots enable row level security;
alter table streams.streams_ai_idempotency_records enable row level security;

create or replace function streams.streams_ai_mark_stalled_operations()
returns integer language plpgsql security definer as $$
declare changed integer;
begin
  update streams.streams_ai_operations
  set status='failed', stage='FAILED', failure=jsonb_build_object(
      'code','OPERATION_STALLED','stage',stage,'safeMessage','The operation stopped responding. Completed artifacts were preserved.','retryable',true
    ), updated_at=now()
  where status='running' and coalesce(heartbeat_at,updated_at) < now() - interval '2 minutes';
  get diagnostics changed = row_count;
  return changed;
end $$;
