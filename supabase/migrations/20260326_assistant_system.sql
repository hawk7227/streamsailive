-- ── STREAMS AI Assistant — full persistence schema ──────────────────────────

-- Conversation threads
create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  pipeline_session_id text,
  niche_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- All messages (text + multimodal attachments)
create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  attachments jsonb default '[]'::jsonb,
  tool_calls jsonb default '[]'::jsonb,
  provider text default 'openai',
  model text,
  created_at timestamptz not null default now()
);

-- Tool execution log
create table if not exists assistant_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  message_id uuid references assistant_messages(id) on delete cascade,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- User-stored API keys (encrypted value)
create table if not exists assistant_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  label text not null,
  encrypted_key text not null,
  scopes text[] default '{}',
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, label)
);

-- Memory: extracted facts from pipeline runs
create table if not exists assistant_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references assistant_conversations(id) on delete set null,
  memory_type text not null check (memory_type in ('pipeline_run','image_url','decision','error','custom')),
  key text not null,
  value jsonb not null,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table assistant_conversations enable row level security;
alter table assistant_messages enable row level security;
alter table assistant_tool_calls enable row level security;
alter table assistant_api_keys enable row level security;
alter table assistant_memory enable row level security;

create policy "users own conversations" on assistant_conversations for all using (auth.uid() = user_id);
create policy "users own messages" on assistant_messages for all using (
  conversation_id in (select id from assistant_conversations where user_id = auth.uid())
);
create policy "users own tool calls" on assistant_tool_calls for all using (
  conversation_id in (select id from assistant_conversations where user_id = auth.uid())
);
create policy "users own api keys" on assistant_api_keys for all using (auth.uid() = user_id);
create policy "users own memory" on assistant_memory for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_assistant_messages_conv on assistant_messages(conversation_id, created_at);
create index if not exists idx_assistant_memory_user on assistant_memory(user_id, memory_type);
create index if not exists idx_assistant_tool_calls_conv on assistant_tool_calls(conversation_id);
