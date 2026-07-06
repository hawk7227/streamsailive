create schema if not exists streams;

create table if not exists streams.streams_ai_memories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  project_id uuid null,
  session_id uuid null,
  source_message_id uuid null,
  scope text not null default 'user',
  memory_type text not null default 'fact',
  title text not null default '',
  content text not null,
  summary text not null default '',
  keywords text[] not null default '{}',
  embedding jsonb null,
  confidence_score numeric not null default 0.75,
  importance_score numeric not null default 0.50,
  recency_score numeric not null default 1.00,
  use_count integer not null default 0,
  last_used_at timestamptz null,
  expires_at timestamptz null,
  is_user_visible boolean not null default true,
  is_user_editable boolean not null default true,
  is_sensitive boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists streams.streams_ai_memory_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  project_id uuid null,
  memory_id uuid null references streams.streams_ai_memories(id) on delete cascade,
  source_table text null,
  source_id uuid null,
  chunk_index integer not null default 0,
  content text not null,
  keywords text[] not null default '{}',
  embedding jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists streams.streams_ai_project_knowledge (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  project_id uuid not null,
  knowledge_type text not null default 'project_fact',
  title text not null default '',
  content text not null,
  summary text not null default '',
  keywords text[] not null default '{}',
  confidence_score numeric not null default 0.75,
  importance_score numeric not null default 0.50,
  source_session_id uuid null,
  source_message_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists streams_ai_memories_lookup_idx on streams.streams_ai_memories(tenant_id, user_id, project_id, scope, memory_type);
create index if not exists streams_ai_memory_chunks_lookup_idx on streams.streams_ai_memory_chunks(tenant_id, user_id, project_id, memory_id);
create index if not exists streams_ai_project_knowledge_lookup_idx on streams.streams_ai_project_knowledge(tenant_id, user_id, project_id, knowledge_type);
