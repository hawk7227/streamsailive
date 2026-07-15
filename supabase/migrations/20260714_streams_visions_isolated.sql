create table if not exists public.streams_visions_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New vision',
  mode text not null default 'ask_first' check (mode in ('off','ask_first','automatic')),
  active_preview jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams_visions_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.streams_visions_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists streams_visions_conversations_user_idx on public.streams_visions_conversations(user_id, updated_at desc);
create index if not exists streams_visions_messages_conversation_idx on public.streams_visions_messages(conversation_id, created_at asc);

alter table public.streams_visions_conversations enable row level security;
alter table public.streams_visions_messages enable row level security;

create policy "visions conversations owner select" on public.streams_visions_conversations for select using (auth.uid() = user_id);
create policy "visions conversations owner insert" on public.streams_visions_conversations for insert with check (auth.uid() = user_id);
create policy "visions conversations owner update" on public.streams_visions_conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "visions conversations owner delete" on public.streams_visions_conversations for delete using (auth.uid() = user_id);

create policy "visions messages owner select" on public.streams_visions_messages for select using (auth.uid() = user_id);
create policy "visions messages owner insert" on public.streams_visions_messages for insert with check (auth.uid() = user_id);
create policy "visions messages owner delete" on public.streams_visions_messages for delete using (auth.uid() = user_id);
