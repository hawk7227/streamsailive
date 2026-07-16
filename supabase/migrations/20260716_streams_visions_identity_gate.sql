-- Streams Visions identity, likeness, and device-lock gate.
-- This migration is isolated from the normal Streams AI runtime.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'streams-visions-likeness',
  'streams-visions-likeness',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.streams_visions_identity_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text,
  notice_accepted_at timestamptz,
  liveness_status text not null default 'not_started' check (liveness_status in ('not_started','capturing','submitted','manual_review','verified','retake_required','rejected')),
  likeness_profile_status text not null default 'locked' check (likeness_profile_status in ('locked','capturing','pending_review','approved','retake_required','deleted','rejected')),
  review_reason text,
  profile_asset_id uuid,
  challenge text,
  challenge_purpose text check (challenge_purpose is null or challenge_purpose in ('capture','webauthn_register','webauthn_authenticate')),
  challenge_expires_at timestamptz,
  biometric_lock_enabled boolean not null default false,
  biometric_credential_id text,
  biometric_public_key text,
  biometric_sign_count bigint not null default 0,
  biometric_registered_at timestamptz,
  last_biometric_verified_at timestamptz,
  provider_reference text,
  verified_at timestamptz,
  retention_expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams_visions_likeness_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  capture_type text not null check (capture_type in ('front','left_three_quarter','right_three_quarter','upper_body')),
  sha256 text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  width integer not null check (width >= 320),
  height integer not null check (height >= 320),
  verification_status text not null default 'submitted' check (verification_status in ('submitted','approved','rejected','deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists streams_visions_likeness_one_active_capture
on public.streams_visions_likeness_assets(user_id, capture_type)
where deleted_at is null;

create table if not exists public.streams_visions_identity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  result text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.streams_visions_identity_profiles enable row level security;
alter table public.streams_visions_likeness_assets enable row level security;
alter table public.streams_visions_identity_events enable row level security;

drop policy if exists "visions identity profile owner read" on public.streams_visions_identity_profiles;
create policy "visions identity profile owner read"
on public.streams_visions_identity_profiles for select
using (auth.uid() = user_id);

drop policy if exists "visions likeness owner read" on public.streams_visions_likeness_assets;
create policy "visions likeness owner read"
on public.streams_visions_likeness_assets for select
using (auth.uid() = user_id);

drop policy if exists "visions identity events owner read" on public.streams_visions_identity_events;
create policy "visions identity events owner read"
on public.streams_visions_identity_events for select
using (auth.uid() = user_id);

drop policy if exists "visions likeness storage owner read" on storage.objects;
create policy "visions likeness storage owner read"
on storage.objects for select
using (
  bucket_id = 'streams-visions-likeness'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "visions likeness storage owner upload" on storage.objects;
create policy "visions likeness storage owner upload"
on storage.objects for insert
with check (
  bucket_id = 'streams-visions-likeness'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "visions likeness storage owner delete" on storage.objects;
create policy "visions likeness storage owner delete"
on storage.objects for delete
using (
  bucket_id = 'streams-visions-likeness'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function public.streams_visions_touch_identity_profile()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists streams_visions_identity_profile_touch on public.streams_visions_identity_profiles;
create trigger streams_visions_identity_profile_touch
before update on public.streams_visions_identity_profiles
for each row execute function public.streams_visions_touch_identity_profile();
