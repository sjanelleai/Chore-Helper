-- ============================================================
-- HomeQuest — COMPLETE Supabase Setup (Run Once)
-- ============================================================
-- This script is SAFE to run multiple times (idempotent).
-- It uses CREATE IF NOT EXISTS and CREATE OR REPLACE throughout.
-- Run this in: Supabase Dashboard > SQL Editor > New Query > paste > Run
-- ============================================================

-- Enable pgcrypto for PIN hashing
create extension if not exists pgcrypto;

-- ============================================================
-- 1) TABLES
-- ============================================================

-- families: one per parent account (household container)
-- Equivalent to recommended "families" table
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text default 'My Family',
  created_at timestamptz not null default now()
);

-- parent_profiles: links auth users to families (membership)
-- Equivalent to recommended "family_members" table
-- Supports future multi-parent via additional rows
create table if not exists parent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  parent_display_name text,
  created_at timestamptz not null default now()
);

-- children: kid profiles (non-authenticated) under a family
create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  avatar text,
  pin_hash text,
  created_at timestamptz not null default now()
);

-- child_points: running point totals per child
create table if not exists child_points (
  child_id uuid primary key references children(id) on delete cascade,
  points int not null default 0,
  lifetime_points int not null default 0,
  updated_at timestamptz not null default now()
);

-- family_config: per-family settings + catalog configuration
-- Equivalent to recommended "family_settings" table
-- Contains BOTH structured settings AND catalog config (chores/rewards)
create table if not exists family_config (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade unique,
  enabled_chores jsonb not null default '{}'::jsonb,
  enabled_rewards jsonb not null default '{}'::jsonb,
  points_by_chore_id jsonb not null default '{}'::jsonb,
  cost_by_reward_id jsonb not null default '{}'::jsonb,
  allowance_enabled boolean not null default false,
  points_per_dollar int not null default 600,
  parent_email text,
  updated_at timestamptz not null default now()
);

-- Add columns that may not exist yet (safe to run multiple times)
ALTER TABLE family_config ADD COLUMN IF NOT EXISTS secondary_parent_email text;
ALTER TABLE family_config ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean DEFAULT false;
ALTER TABLE family_config ADD COLUMN IF NOT EXISTS daily_summary_time_local text DEFAULT '18:00';
ALTER TABLE family_config ADD COLUMN IF NOT EXISTS daily_summary_timezone text DEFAULT 'America/Denver';

-- email_send_log: prevent duplicate sends + audit nightly summary delivery
create table if not exists email_send_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  date_key date not null,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now(),
  unique (family_id, date_key)
);

-- daily_status: per child, per day chore completion tracking
create table if not exists daily_status (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  date_key text not null,
  completed_chores jsonb not null default '{}'::jsonb,
  unique (child_id, date_key)
);

-- ledger_events: point audit trail per child
create table if not exists ledger_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  type text not null,
  ref_id text not null,
  points_delta int not null,
  note text,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_ledger_family_child_time on ledger_events(family_id, child_id, occurred_at desc);

-- purchases: per child purchase history
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  reward_id text not null,
  reward_name text not null,
  cost int not null,
  purchased_at timestamptz not null default now()
);

-- child_badges: per child earned badges
create table if not exists child_badges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  badge_key text not null,
  badge_name text not null,
  badge_icon text not null,
  threshold int not null,
  earned_at timestamptz not null default now(),
  unique (child_id, badge_key)
);

-- ============================================================
-- 2) HELPER FUNCTION: get current user's family_id
-- ============================================================

create or replace function current_family_id()
returns uuid
language sql stable
security definer
as $$
  select family_id from parent_profiles where user_id = auth.uid()
$$;

-- ============================================================
-- 3) ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table families enable row level security;
alter table parent_profiles enable row level security;
alter table children enable row level security;
alter table child_points enable row level security;
alter table family_config enable row level security;
alter table daily_status enable row level security;
alter table ledger_events enable row level security;
alter table purchases enable row level security;
alter table child_badges enable row level security;

-- Drop existing policies first (safe if they don't exist)
do $$ begin
  -- families
  drop policy if exists "families_select_owner" on families;
  drop policy if exists "families_update_owner" on families;
  -- parent_profiles
  drop policy if exists "parent_profiles_select_own" on parent_profiles;
  drop policy if exists "parent_profiles_insert_own" on parent_profiles;
  -- children
  drop policy if exists "children_select" on children;
  drop policy if exists "children_insert" on children;
  drop policy if exists "children_update" on children;
  drop policy if exists "children_delete" on children;
  -- child_points
  drop policy if exists "child_points_select" on child_points;
  drop policy if exists "child_points_insert" on child_points;
  drop policy if exists "child_points_update" on child_points;
  -- family_config
  drop policy if exists "family_config_select" on family_config;
  drop policy if exists "family_config_insert" on family_config;
  drop policy if exists "family_config_update" on family_config;
  -- daily_status
  drop policy if exists "daily_status_select" on daily_status;
  drop policy if exists "daily_status_insert" on daily_status;
  drop policy if exists "daily_status_update" on daily_status;
  -- ledger_events
  drop policy if exists "ledger_select" on ledger_events;
  drop policy if exists "ledger_insert" on ledger_events;
  -- purchases
  drop policy if exists "purchases_select" on purchases;
  drop policy if exists "purchases_insert" on purchases;
  -- child_badges
  drop policy if exists "child_badges_select" on child_badges;
  drop policy if exists "child_badges_insert" on child_badges;
end $$;

-- families
create policy "families_select_owner" on families
  for select using (owner_user_id = auth.uid());
create policy "families_update_owner" on families
  for update using (owner_user_id = auth.uid());

-- parent_profiles
create policy "parent_profiles_select_own" on parent_profiles
  for select using (user_id = auth.uid());
create policy "parent_profiles_insert_own" on parent_profiles
  for insert with check (user_id = auth.uid());

-- children
create policy "children_select" on children
  for select using (family_id = current_family_id());
create policy "children_insert" on children
  for insert with check (family_id = current_family_id());
create policy "children_update" on children
  for update using (family_id = current_family_id());
create policy "children_delete" on children
  for delete using (family_id = current_family_id());

-- child_points
create policy "child_points_select" on child_points
  for select using (child_id in (select id from children where family_id = current_family_id()));
create policy "child_points_insert" on child_points
  for insert with check (child_id in (select id from children where family_id = current_family_id()));
create policy "child_points_update" on child_points
  for update using (child_id in (select id from children where family_id = current_family_id()));

-- family_config
create policy "family_config_select" on family_config
  for select using (family_id = current_family_id());
create policy "family_config_insert" on family_config
  for insert with check (family_id = current_family_id());
create policy "family_config_update" on family_config
  for update using (family_id = current_family_id());

-- daily_status
create policy "daily_status_select" on daily_status
  for select using (child_id in (select id from children where family_id = current_family_id()));
create policy "daily_status_insert" on daily_status
  for insert with check (child_id in (select id from children where family_id = current_family_id()));
create policy "daily_status_update" on daily_status
  for update using (child_id in (select id from children where family_id = current_family_id()));

-- ledger_events
create policy "ledger_select" on ledger_events
  for select using (family_id = current_family_id());
create policy "ledger_insert" on ledger_events
  for insert with check (family_id = current_family_id());

-- purchases
create policy "purchases_select" on purchases
  for select using (family_id = current_family_id());
create policy "purchases_insert" on purchases
  for insert with check (family_id = current_family_id());

-- child_badges
create policy "child_badges_select" on child_badges
  for select using (child_id in (select id from children where family_id = current_family_id()));
create policy "child_badges_insert" on child_badges
  for insert with check (child_id in (select id from children where family_id = current_family_id()));

-- ============================================================
-- 4) TRIGGER: Auto-create family on signup
-- ============================================================
-- When a new user signs up, automatically create:
--   families row + parent_profiles row + family_config row
-- Also auto-fills parent_email from the signup email.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
begin
  insert into families (owner_user_id, name)
  values (new.id, 'My Family')
  returning id into v_family_id;

  insert into parent_profiles (user_id, family_id, parent_display_name)
  values (new.id, v_family_id, coalesce(new.raw_user_meta_data->>'name', 'Parent'));

  insert into family_config (family_id, parent_email) values (v_family_id, new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

-- ============================================================
-- 5) RPC: Ensure family exists (fallback if trigger didn't fire)
-- ============================================================
-- Called by frontend on login. If the trigger worked, this is a fast no-op.
-- If the trigger failed, this creates everything needed in one atomic call.
-- This is THE fix for the "Setting up your family profile..." loop.

create or replace function ensure_family_exists(p_display_name text default 'Parent')
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_family_id uuid;
  v_profile record;
  v_user_email text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  -- Check if parent_profiles row already exists (fast path)
  select family_id, parent_display_name into v_profile
  from parent_profiles
  where user_id = v_user_id;

  if v_profile.family_id is not null then
    return json_build_object('family_id', v_profile.family_id, 'display_name', coalesce(v_profile.parent_display_name, p_display_name));
  end if;

  -- Slow path: trigger didn't fire, create everything
  select email into v_user_email from auth.users where id = v_user_id;

  -- Check if family already exists (half-created state)
  select id into v_family_id from families where owner_user_id = v_user_id limit 1;

  if v_family_id is null then
    insert into families (owner_user_id, name) values (v_user_id, 'My Family')
    returning id into v_family_id;
  end if;

  insert into parent_profiles (user_id, family_id, parent_display_name)
  values (v_user_id, v_family_id, p_display_name)
  on conflict (user_id) do nothing;

  insert into family_config (family_id, parent_email)
  values (v_family_id, v_user_email)
  on conflict (family_id) do nothing;

  return json_build_object('family_id', v_family_id, 'display_name', p_display_name);
end;
$$;

-- ============================================================
-- 6) RPC: Create child with optional PIN
-- ============================================================

create or replace function create_child(p_name text, p_avatar text, p_pin text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_child_id uuid;
  v_family uuid;
  v_hash text;
begin
  v_family := current_family_id();
  if v_family is null then raise exception 'No family found'; end if;

  if p_pin is null or length(p_pin) = 0 then
    v_hash := null;
  else
    v_hash := crypt(p_pin, gen_salt('bf'));
  end if;

  insert into children (family_id, name, avatar, pin_hash)
  values (v_family, p_name, p_avatar, v_hash)
  returning id into v_child_id;

  insert into child_points (child_id, points, lifetime_points) values (v_child_id, 0, 0);

  return v_child_id;
end;
$$;

-- ============================================================
-- 7) RPC: Verify child PIN
-- ============================================================

create or replace function verify_child_pin(p_child_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_family uuid;
  v_hash text;
begin
  select family_id, pin_hash into v_family, v_hash
  from children
  where id = p_child_id;

  if v_family is null then return false; end if;
  if v_family <> current_family_id() then return false; end if;
  if v_hash is null then return true; end if;

  return (crypt(p_pin, v_hash) = v_hash);
end;
$$;

-- ============================================================
-- 8) RPC: Increment child points (atomic)
-- ============================================================

create or replace function increment_child_points(p_child_id uuid, p_delta int, p_add_lifetime boolean default false)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from children
    where id = p_child_id and family_id = current_family_id()
  ) then
    raise exception 'Not allowed';
  end if;

  if p_add_lifetime then
    update child_points
    set points = greatest(0, points + p_delta),
        lifetime_points = lifetime_points + greatest(0, p_delta),
        updated_at = now()
    where child_id = p_child_id;
  else
    update child_points
    set points = greatest(0, points + p_delta),
        updated_at = now()
    where child_id = p_child_id;
  end if;
end;
$$;

-- ============================================================
-- 9) BACKFILL: Fill in parent_email for existing accounts
-- ============================================================
-- Safe to run multiple times. Only updates rows where parent_email is missing.

UPDATE family_config fc
SET parent_email = u.email
FROM parent_profiles pp
JOIN auth.users u ON u.id = pp.user_id
JOIN families f ON f.id = pp.family_id
WHERE fc.family_id = f.id
  AND (fc.parent_email IS NULL OR fc.parent_email = '');

-- ============================================================
-- 10) VERIFICATION: Run after setup to confirm everything works
-- ============================================================
-- These queries should all return results for your account.
-- Uncomment and run individually to verify:

-- Check the RPC exists:
-- SELECT proname FROM pg_proc WHERE proname = 'ensure_family_exists';

-- Check the trigger exists:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check RLS policies exist:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('families','parent_profiles','children','family_config')
-- ORDER BY tablename, policyname;

-- Check your family data (replace UUID with your auth user ID):
-- SELECT pp.user_id, pp.family_id, pp.parent_display_name, fc.parent_email
-- FROM parent_profiles pp
-- JOIN family_config fc ON fc.family_id = pp.family_id
-- WHERE pp.user_id = 'YOUR_AUTH_USER_UUID_HERE';

-- ============================================================
-- DONE! Your Supabase database is fully configured for HomeQuest.
-- ============================================================
