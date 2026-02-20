-- ============================================================
-- HomeQuest — Schema Migration v5
-- Align to per-chore daily_status + catalog title columns
-- ============================================================
-- Fixes two critical mismatches:
--   A) daily_status: array-based → per-chore-row model
--   B) catalog columns: name → title
-- Also: standardizes email_send_log, updates toggle_chore RPC,
--        updates remove_child RPC, updates seed_default_catalog RPC
--
-- SAFE to run in Supabase SQL Editor. Uses transactions.
-- Run AFTER v4 migration.
-- ============================================================

begin;

-- ============================================================
-- 1) Catalog: add title columns, backfill from name
-- ============================================================

alter table if exists public.chore_catalog
  add column if not exists title text;

update public.chore_catalog
set title = coalesce(title, name, 'Untitled')
where title is null;

alter table public.chore_catalog
  alter column title set default '';

alter table if exists public.reward_catalog
  add column if not exists title text;

update public.reward_catalog
set title = coalesce(title, name, 'Untitled')
where title is null;

alter table public.reward_catalog
  alter column title set default '';

-- ============================================================
-- 2) Create daily_status_v2 table (per chore per day)
-- ============================================================

create table if not exists public.daily_status_v2 (
  child_id uuid not null references public.children(id) on delete cascade,
  chore_id uuid not null references public.chore_catalog(id) on delete cascade,
  date_key date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (child_id, chore_id, date_key)
);

create index if not exists idx_daily_status_v2_child_day
  on public.daily_status_v2 (child_id, date_key);

alter table public.daily_status_v2 enable row level security;

drop policy if exists daily_status_v2_select_member on public.daily_status_v2;
drop policy if exists daily_status_v2_insert_member on public.daily_status_v2;
drop policy if exists daily_status_v2_update_member on public.daily_status_v2;
drop policy if exists daily_status_v2_delete_member on public.daily_status_v2;

create policy daily_status_v2_select_member
  on public.daily_status_v2
  for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = daily_status_v2.child_id
        and is_family_member(c.family_id)
    )
  );

create policy daily_status_v2_insert_member
  on public.daily_status_v2
  for insert
  with check (
    exists (
      select 1
      from public.children c
      where c.id = daily_status_v2.child_id
        and is_family_member(c.family_id)
    )
  );

create policy daily_status_v2_update_member
  on public.daily_status_v2
  for update
  using (
    exists (
      select 1
      from public.children c
      where c.id = daily_status_v2.child_id
        and is_family_member(c.family_id)
    )
  )
  with check (
    exists (
      select 1
      from public.children c
      where c.id = daily_status_v2.child_id
        and is_family_member(c.family_id)
    )
  );

create policy daily_status_v2_delete_member
  on public.daily_status_v2
  for delete
  using (
    exists (
      select 1
      from public.children c
      where c.id = daily_status_v2.child_id
        and is_family_member(c.family_id)
    )
  );

-- ============================================================
-- 3) Data migration from legacy daily_status (array model)
-- ============================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='daily_status'
      and column_name='completed_chore_ids'
  ) then
    insert into public.daily_status_v2 (child_id, chore_id, date_key, completed)
    select
      ds.child_id,
      unnest(ds.completed_chore_ids) as chore_id,
      ds.date_key,
      true
    from public.daily_status ds
    where ds.completed_chore_ids is not null
      and array_length(ds.completed_chore_ids, 1) > 0
    on conflict do nothing;
  end if;
end $$;

-- ============================================================
-- 4) Rewrite toggle_chore RPC for per-chore-row model
--    WITH points_ledger writes preserved
-- ============================================================

drop function if exists public.toggle_chore(uuid, uuid, date);

create or replace function public.toggle_chore(
  p_child_id uuid,
  p_chore_id uuid,
  p_date_key date
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_points int;
  v_deleted int;
begin
  select family_id into v_family_id
  from children where id = p_child_id;

  if v_family_id is null then
    return json_build_object('error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('error', 'Not authorized');
  end if;

  select points into v_points
  from chore_catalog
  where id = p_chore_id and family_id = v_family_id and active = true;

  if v_points is null then
    return json_build_object('error', 'Chore not found or inactive');
  end if;

  delete from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_uncheck', p_chore_id, -v_points, '{}');

    return json_build_object('ok', true, 'completed', false);
  else
    insert into public.daily_status_v2 (child_id, chore_id, date_key, completed)
    values (p_child_id, p_chore_id, p_date_key, true);

    insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_complete', p_chore_id, v_points, '{}');

    return json_build_object('ok', true, 'completed', true);
  end if;
end;
$$;

grant execute on function public.toggle_chore(uuid, uuid, date) to authenticated;

-- ============================================================
-- 5) Update remove_child RPC to also delete from daily_status_v2
-- ============================================================

create or replace function remove_child(p_child_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
  from children
  where id = p_child_id;

  if v_family_id is null then
    raise exception 'Child not found';
  end if;

  if not is_family_member(v_family_id) then
    raise exception 'Not authorized';
  end if;

  delete from daily_status_v2 where child_id = p_child_id;
  delete from daily_status where child_id = p_child_id;
  delete from points_ledger where child_id = p_child_id;
  delete from reward_redemptions where child_id = p_child_id;
  delete from child_badges where child_id = p_child_id;
  delete from children where id = p_child_id;

  return jsonb_build_object('ok', true, 'child_id', p_child_id);
end;
$$;

-- ============================================================
-- 6) Update seed_default_catalog to populate title column
-- ============================================================

create or replace function seed_default_catalog(p_family_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_chore_count int;
  v_reward_count int;
begin
  if not is_family_member(p_family_id) then
    return json_build_object('error', 'Not authorized');
  end if;

  select count(*) into v_chore_count from chore_catalog where family_id = p_family_id;
  if v_chore_count > 0 then
    return json_build_object('seeded', false, 'reason', 'Catalog already exists');
  end if;

  insert into chore_catalog (family_id, category, name, title, points, active, sort_order) values
    (p_family_id, 'Room', 'Make bed', 'Make bed', 15, true, 1),
    (p_family_id, 'Room', 'Put clothes in hamper', 'Put clothes in hamper', 15, true, 2),
    (p_family_id, 'Room', 'Pick up floor', 'Pick up floor', 20, true, 3),
    (p_family_id, 'Room', 'Tidy desk', 'Tidy desk', 20, false, 4),
    (p_family_id, 'Room', 'Clean room (quick)', 'Clean room (quick)', 35, false, 5),
    (p_family_id, 'Room', 'Clean room (deep)', 'Clean room (deep)', 120, false, 6),
    (p_family_id, 'Kitchen', 'Clear your plate', 'Clear your plate', 15, false, 7),
    (p_family_id, 'Kitchen', 'Load dishwasher', 'Load dishwasher', 30, false, 8),
    (p_family_id, 'Kitchen', 'Unload dishwasher', 'Unload dishwasher', 40, false, 9),
    (p_family_id, 'Kitchen', 'Wipe counters', 'Wipe counters', 35, false, 10),
    (p_family_id, 'Kitchen', 'Set the table', 'Set the table', 20, false, 11),
    (p_family_id, 'Pets', 'Feed pet', 'Feed pet', 20, true, 12),
    (p_family_id, 'Pets', 'Water bowl', 'Water bowl', 15, false, 13),
    (p_family_id, 'Pets', 'Help with pet cleanup', 'Help with pet cleanup', 40, false, 14),
    (p_family_id, 'School', 'Homework (15 min)', 'Homework (15 min)', 25, true, 15),
    (p_family_id, 'School', 'Homework (30 min)', 'Homework (30 min)', 50, false, 16),
    (p_family_id, 'School', 'Reading (15 min)', 'Reading (15 min)', 25, false, 17),
    (p_family_id, 'School', 'Pack backpack', 'Pack backpack', 20, true, 18),
    (p_family_id, 'Family', 'Help sibling (kindly)', 'Help sibling (kindly)', 25, false, 19),
    (p_family_id, 'Family', 'Take out small trash', 'Take out small trash', 25, false, 20),
    (p_family_id, 'Family', 'Laundry helper', 'Laundry helper', 40, false, 21)
  on conflict (family_id, category, name) do nothing;

  insert into reward_catalog (family_id, category, name, title, cost, requires_approval, active, sort_order) values
    (p_family_id, 'Privileges', 'Pick music in the car', 'Pick music in the car', 700, false, true, 1),
    (p_family_id, 'Privileges', 'Pick a family game', 'Pick a family game', 650, false, false, 2),
    (p_family_id, 'Privileges', 'Extra screen time +15 min', 'Extra screen time +15 min', 1200, true, true, 3),
    (p_family_id, 'Privileges', 'Extra screen time +30 min', 'Extra screen time +30 min', 2000, true, false, 4),
    (p_family_id, 'Privileges', 'Stay up +15 min', 'Stay up +15 min', 1400, true, true, 5),
    (p_family_id, 'Privileges', 'Stay up +30 min', 'Stay up +30 min', 2400, true, false, 6),
    (p_family_id, 'Privileges', 'Stay up +60 min (VERY expensive)', 'Stay up +60 min (VERY expensive)', 4500, true, false, 7),
    (p_family_id, 'Experiences', 'Ice cream outing', 'Ice cream outing', 2200, true, false, 8),
    (p_family_id, 'Experiences', 'Movie night (pick the movie)', 'Movie night (pick the movie)', 2600, true, true, 9),
    (p_family_id, 'Experiences', 'Arcade trip', 'Arcade trip', 3500, true, true, 10),
    (p_family_id, 'Experiences', 'Bowling night', 'Bowling night', 4200, true, false, 11),
    (p_family_id, 'Experiences', 'Friend playdate', 'Friend playdate', 3000, true, false, 12),
    (p_family_id, 'Food Treats', 'Special dessert', 'Special dessert', 1200, false, true, 13),
    (p_family_id, 'Food Treats', 'Smoothie / fancy drink', 'Smoothie / fancy drink', 1500, false, false, 14),
    (p_family_id, 'Food Treats', 'Pick dinner (within rules)', 'Pick dinner (within rules)', 3200, true, false, 15),
    (p_family_id, 'Toys / Items', 'Small toy / trinket', 'Small toy / trinket', 3000, true, false, 16),
    (p_family_id, 'Toys / Items', 'New book', 'New book', 4200, true, false, 17),
    (p_family_id, 'Toys / Items', 'Bigger toy (rare)', 'Bigger toy (rare)', 9000, true, false, 18)
  on conflict (family_id, category, name) do nothing;

  select count(*) into v_chore_count from chore_catalog where family_id = p_family_id;
  select count(*) into v_reward_count from reward_catalog where family_id = p_family_id;

  return json_build_object('seeded', true, 'chores', v_chore_count, 'rewards', v_reward_count);
end;
$$;

-- ============================================================
-- 7) Standardize email_send_log.family_id as NOT NULL
-- ============================================================
-- Already NOT NULL in v4 migration. This is a safety check.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_send_log'
      and column_name = 'family_id'
      and is_nullable = 'YES'
  ) then
    delete from email_send_log where family_id is null;
    alter table email_send_log alter column family_id set not null;
  end if;
end $$;

-- ============================================================
-- 8) Index on daily_status_v2 for email summary queries
-- ============================================================

create index if not exists idx_daily_status_v2_date
  on public.daily_status_v2 (date_key);

commit;

-- ============================================================
-- DONE! After running this migration:
--   1. Frontend should query daily_status_v2 (not daily_status)
--   2. Frontend should use .title for catalog display
--   3. Old daily_status table is kept for reference (not dropped)
-- ============================================================
