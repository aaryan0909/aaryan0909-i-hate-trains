-- I Hate Trains v35 accounts. Supabase migration.
-- Run this in the Supabase Dashboard SQL Editor, on the project the
-- owner approves. It creates no users and stores no secrets.
-- Shape mirrors the on-device keys app.js already owns:
--   iht_profile  -> profiles (name, city, line)
--   iht_pet      -> profiles (pet_type, pet_name, pet_color, pet_accessory)
--   iht_prefs    -> profiles.prefs (jsonb)
--   iht_plan     -> user_data row data_key = 'plan' (contact phone excluded, see below)
--   iht_journal  -> user_data row data_key = 'journal'
--   iht_trips    -> user_data row data_key = 'trips'
--   iht_comfort  -> user_data row data_key = 'comfort'
-- DELIBERATE EXCLUSION: iht_plan.reachPhone (the backup plan contact
-- phone number) is never written to user_data by auth.js. It stays on
-- the phone only. Do not add it to a sync payload later without a
-- privacy review, because it belongs to someone else, not the rider.
-- Row-level security: every policy below restricts rows to the
-- signed-in user (auth.uid()). No user can read or write another
-- user's row, including through user_data and deletion requests.

-- Profiles: one row per auth user, keyed by the auth user id.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  city text,
  line text,
  pet_type text,
  pet_name text,
  pet_color text,
  pet_accessory text,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sync store: one row per user per on-device key. auth.js upserts
-- with onConflict (user_id, data_key), so a second phone overwrites
-- its own key only, never another user's.
create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data_key text not null,
  data_value jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, data_key)
);
create index if not exists user_data_user_id_idx on public.user_data (user_id);

-- Account deletion requests: the app inserts a pending row, then
-- signs the user out. Actual deletion is an owner-side job (see
-- SUPABASE_SETUP.md). The row itself is own-user only.
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  requested_at timestamptz not null default now()
);
create index if not exists deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id);

-- Keep updated_at honest on profiles.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Row-level security: on, and locked to the owner on every table.
alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "user_data own rows" on public.user_data;
create policy "user_data own rows" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "deletion requests own rows" on public.account_deletion_requests;
create policy "deletion requests own rows" on public.account_deletion_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
