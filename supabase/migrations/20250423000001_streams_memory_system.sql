-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — Streams Memory System
-- Provides persistent project memory across sessions.
-- Purpose: continuity comes from the system, not chat history.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. project_memory_rules ───────────────────────────────────────────────────
-- Persistent rules that govern how a project is built.
-- Written by the operator. Loaded at the start of every build session.
-- Examples: "always use tokens.ts for colours", "never use !important"

create table if not exists project_memory_rules (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid references projects(id) on delete cascade,
  rule_text     text not null,
  category      text not null default 'general',
  -- category: 'code' | 'design' | 'process' | 'general'
  priority      integer not null default 0,
  -- higher = loaded first. top 20 by priority loaded per session
  is_active     boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists project_memory_rules_workspace_idx
  on project_memory_rules(workspace_id, is_active, priority desc);

create index if not exists project_memory_rules_project_idx
  on project_memory_rules(project_id, is_active, priority desc);

-- ── 2. decision_log ───────────────────────────────────────────────────────────
-- Record of every meaningful decision made per project.
-- What was decided, why, and what the outcome was.

create table if not exists decision_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid references projects(id) on delete cascade,
  session_id    text,
  -- what was decided
  decision_text text not null,
  -- rationale captured at time of decision
  rationale     text,
  -- outcome: 'pending' | 'proven' | 'reverted' | 'superseded'
  outcome       text not null default 'pending',
  -- link back to proof_records if proven
  proof_record_id uuid,
  made_by       uuid references auth.users(id),
  made_at       timestamptz not null default now()
);

create index if not exists decision_log_project_idx
  on decision_log(project_id, made_at desc);

create index if not exists decision_log_workspace_idx
  on decision_log(workspace_id, made_at desc);

-- ── 3. issue_history ──────────────────────────────────────────────────────────
-- What went wrong per project, and what fixed it.
-- Prevents the same mistake being made twice.

create table if not exists issue_history (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  project_id     uuid references projects(id) on delete cascade,
  session_id     text,
  -- short description of the issue
  issue_summary  text not null,
  -- full detail: what happened, what was tried
  issue_detail   text,
  -- what resolved it (null if still open)
  resolution     text,
  -- 'open' | 'resolved' | 'wont_fix'
  status         text not null default 'open',
  -- issue category for filtering
  category       text not null default 'build',
  -- category: 'build' | 'design' | 'runtime' | 'data' | 'auth' | 'other'
  occurred_at    timestamptz not null default now(),
  resolved_at    timestamptz
);

create index if not exists issue_history_project_idx
  on issue_history(project_id, status, occurred_at desc);

create index if not exists issue_history_workspace_idx
  on issue_history(workspace_id, status, occurred_at desc);

-- ── 4. session_summaries ──────────────────────────────────────────────────────
-- End-of-session summaries. What was done, what is pending, what to do next.
-- Loaded at the start of the next session to restore context.

create table if not exists session_summaries (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  project_id     uuid references projects(id) on delete cascade,
  session_id     text not null,
  -- human-readable summary of what happened this session
  summary_text   text not null,
  -- structured: what was completed
  completed      text[] not null default '{}',
  -- structured: what is still in progress
  in_progress    text[] not null default '{}',
  -- structured: what to do in the next session
  next_steps     text[] not null default '{}',
  -- key files touched this session
  files_touched  text[] not null default '{}',
  -- last known git commit hash
  last_commit    text,
  -- was Vercel green at end of session?
  vercel_green   boolean,
  created_at     timestamptz not null default now()
);

create index if not exists session_summaries_project_idx
  on session_summaries(project_id, created_at desc);

-- ── 5. latest_handoffs ────────────────────────────────────────────────────────
-- One row per project — the single most recent handoff document.
-- Upserted at session end. Loaded at session start.
-- Contains everything needed to resume work without reading chat history.

create table if not exists latest_handoffs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade unique,
  -- full handoff markdown
  handoff_text     text not null,
  -- last known commit hash
  last_commit      text,
  -- last Vercel status
  last_vercel_status text,
  -- audit violation count at handoff time
  violation_count  integer not null default 0,
  -- pending work items extracted from handoff
  pending_items    text[] not null default '{}',
  generated_at     timestamptz not null default now(),
  generated_by     uuid references auth.users(id)
);

create index if not exists latest_handoffs_workspace_idx
  on latest_handoffs(workspace_id);

-- ── 6. pinned_project_facts ───────────────────────────────────────────────────
-- Short key=value facts pinned to a project.
-- Loaded at every session start, no truncation.
-- Examples: repo URL, branch, Vercel project ID, tech stack, last green deploy.

create table if not exists pinned_project_facts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  fact_key      text not null,
  fact_value    text not null,
  is_sensitive  boolean not null default false,
  -- sensitive facts shown masked in UI
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(project_id, fact_key)
);

create index if not exists pinned_project_facts_project_idx
  on pinned_project_facts(project_id);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table project_memory_rules  enable row level security;
alter table decision_log          enable row level security;
alter table issue_history         enable row level security;
alter table session_summaries     enable row level security;
alter table latest_handoffs       enable row level security;
alter table pinned_project_facts  enable row level security;

-- Workspace members can read/write their own workspace memory
create policy "workspace_members_memory_rules" on project_memory_rules
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_decision_log" on decision_log
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_issue_history" on issue_history
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_session_summaries" on session_summaries
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_latest_handoffs" on latest_handoffs
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_pinned_facts" on pinned_project_facts
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );
