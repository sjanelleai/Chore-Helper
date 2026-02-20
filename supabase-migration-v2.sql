-- ============================================================
-- HomeQuest — Schema Migration v2
-- ============================================================
-- Updates RPCs and helpers to work with the actual Supabase schema:
--   family_members (instead of parent_profiles)
--   family_settings (instead of family_config for settings)
--   children.display_name (instead of children.name)
--
-- SAFE to run multiple times (idempotent / CREATE OR REPLACE).
-- Run in: Supabase Dashboard > SQL Editor > New Query > paste > Run
-- ============================================================

-- ============================================================
-- 1) HELPER: current_family_id() — updated for family_members
-- ============================================================

create or replace function current_family_id()
returns uuid
language sql stable
security definer
as $$
  select family_id from family_members where user_id = auth.uid()
$$;

-- ============================================================
-- 2) RPC: ensure_family_exists — updated for new schema
-- ============================================================
-- Creates families + family_members + family_settings if missing.
-- Called by frontend on login as fallback if trigger didn't fire.

create or replace function ensure_family_exists(p_display_name text default 'Parent')
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_family_id uuid;
  v_existing_family_id uuid;
  v_display_name text;
  v_user_email text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  -- Fast path: check if family_members row already exists
  select family_id into v_existing_family_id
  from family_members
  where user_id = v_user_id;

  if v_existing_family_id is not null then
    -- Already set up, return existing data
    select name into v_display_name from families where id = v_existing_family_id;
    return json_build_object(
      'family_id', v_existing_family_id,
      'display_name', coalesce(v_display_name, p_display_name)
    );
  end if;

  -- Slow path: trigger didn't fire, create everything atomically
  select email into v_user_email from auth.users where id = v_user_id;

  -- Check if family already exists (half-created state)
  select id into v_family_id from families where owner_user_id = v_user_id limit 1;

  if v_family_id is null then
    insert into families (owner_user_id, name)
    values (v_user_id, coalesce(p_display_name, 'My Family'))
    returning id into v_family_id;
  end if;

  -- Create family_members row
  insert into family_members (user_id, family_id, role)
  values (v_user_id, v_family_id, 'parent')
  on conflict (user_id) do nothing;

  -- Create family_settings row with email from auth
  insert into family_settings (family_id, primary_parent_email)
  values (v_family_id, v_user_email)
  on conflict (family_id) do nothing;

  return json_build_object('family_id', v_family_id, 'display_name', coalesce(p_display_name, 'Parent'));
end;
$$;

-- Grant execute to authenticated users
grant execute on function ensure_family_exists(text) to authenticated;
grant execute on function current_family_id() to authenticated;
grant execute on function increment_child_points(uuid, int, boolean) to authenticated;

-- ============================================================
-- 3) Ensure family_settings has RLS policies
-- ============================================================

alter table family_settings enable row level security;

do $$ begin
  drop policy if exists "family_settings_select" on family_settings;
  drop policy if exists "family_settings_insert" on family_settings;
  drop policy if exists "family_settings_update" on family_settings;
end $$;

create policy "family_settings_select" on family_settings
  for select using (family_id = current_family_id());
create policy "family_settings_insert" on family_settings
  for insert with check (family_id = current_family_id());
create policy "family_settings_update" on family_settings
  for update using (family_id = current_family_id());

-- ============================================================
-- 4) Ensure family_members has RLS policies
-- ============================================================

alter table family_members enable row level security;

do $$ begin
  drop policy if exists "family_members_select_own" on family_members;
  drop policy if exists "family_members_insert_own" on family_members;
end $$;

create policy "family_members_select_own" on family_members
  for select using (user_id = auth.uid());
create policy "family_members_insert_own" on family_members
  for insert with check (user_id = auth.uid());

-- ============================================================
-- DONE! RPCs updated for new schema.
-- ============================================================
