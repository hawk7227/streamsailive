-- ── workspace_files ───────────────────────────────────────────────────────────
-- Backward-compat file references for copilot/legacy API consumers.
-- The canonical file store is the 'files' table (20260327_core_systems.sql).
-- workspace_files is a simplified view written by /api/files/upload for
-- older consumers that query a flat file list per workspace.
-- Safe to re-run (IF NOT EXISTS throughout).

create table if not exists workspace_files (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  type              text not null default 'knowledge'
                    check (type in ('knowledge','asset','voice_dataset')),
  file_path         text not null,
  public_url        text,
  extracted_content text,
  mime_type         text,
  size              bigint default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_workspace_files_workspace
  on workspace_files(workspace_id, created_at desc);

alter table workspace_files enable row level security;

create policy if not exists "users own workspace files"
  on workspace_files for all
  using (user_id = auth.uid());
