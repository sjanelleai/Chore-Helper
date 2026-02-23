-- ============================================================
-- HomeQuest — Schema Migration v6
-- Canonical daily points + catalog versioning
-- ============================================================
-- Two major changes:
--   A) Canonical points_earned_for_day() and family_daily_summary()
--      functions — timezone-safe, ledger-based, single source of truth
--   B) Catalog versioning: family_settings.catalog_version + versioned
--      seed_default_catalog RPC that upserts missing items on upgrade
--
-- SAFE to run in Supabase SQL Editor.
-- Run AFTER v5 migration.
-- ============================================================

begin;

-- ============================================================
-- 1) Canonical: points_earned_for_day(child, date, timezone)
-- ============================================================
-- Computes UTC start/end for a given date_key in a given timezone,
-- then sums ALL ledger deltas inside that window.
-- Includes chore completions, unchecks, bonuses, and redemptions.

create or replace function public.points_earned_for_day(
  p_child_id uuid,
  p_date_key date,
  p_timezone text
)
returns int
language sql
stable
as $$
  with bounds as (
    select
      (p_date_key::timestamp at time zone p_timezone)::timestamptz as utc_start,
      ((p_date_key + 1)::timestamp at time zone p_timezone)::timestamptz as utc_end
  )
  select coalesce(sum(pl.points_delta), 0)::int
  from public.points_ledger pl
  join bounds b on true
  where pl.child_id = p_child_id
    and pl.created_at >= b.utc_start
    and pl.created_at <  b.utc_end;
$$;

grant execute on function public.points_earned_for_day(uuid, date, text) to authenticated;

-- ============================================================
-- 2) Canonical: family_daily_summary(family_id, date_key)
-- ============================================================
-- Returns one row per child with:
--   - points_today (ledger-based, timezone-safe)
--   - completed_count (from daily_status_v2)
--   - completed_chores (array of titles)
--   - missed_chores (array of titles from active catalog)
--   - bonuses (jsonb array of {reason, points})
--   - redemptions (jsonb array of {name, cost})
--   - current_balance (all-time ledger sum)

create or replace function public.family_daily_summary(
  p_family_id uuid,
  p_date_key date
)
returns table (
  child_id uuid,
  child_name text,
  points_today int,
  completed_count int,
  completed_chores text[],
  missed_chores text[],
  bonuses jsonb,
  redemptions jsonb,
  current_balance int
)
language sql
stable
as $$
  with fs as (
    select coalesce(timezone, 'America/Denver') as tz
    from public.family_settings
    where family_id = p_family_id
  ),
  kids as (
    select id as child_id, display_name as child_name
    from public.children
    where family_id = p_family_id
  ),
  active_chores as (
    select id as chore_id, title
    from public.chore_catalog
    where family_id = p_family_id
      and coalesce(active, true) = true
  ),
  completed as (
    select ds.child_id, ds.chore_id
    from public.daily_status_v2 ds
    join kids k on k.child_id = ds.child_id
    where ds.date_key = p_date_key
      and ds.completed = true
  ),
  day_bounds as (
    select
      (p_date_key::timestamp at time zone (select tz from fs))::timestamptz as utc_start,
      ((p_date_key + 1)::timestamp at time zone (select tz from fs))::timestamptz as utc_end
  ),
  day_ledger as (
    select pl.*
    from public.points_ledger pl, day_bounds db
    where pl.family_id = p_family_id
      and pl.created_at >= db.utc_start
      and pl.created_at < db.utc_end
  ),
  child_bonuses as (
    select
      dl.child_id,
      jsonb_agg(jsonb_build_object(
        'reason', coalesce(dl.meta->>'note', 'Bonus'),
        'points', dl.points_delta
      ) order by dl.created_at) as bonus_arr
    from day_ledger dl
    where dl.event_type = 'bonus'
    group by dl.child_id
  ),
  child_redemptions as (
    select
      rr.child_id,
      jsonb_agg(jsonb_build_object(
        'name', coalesce(rc.title, 'Reward'),
        'cost', rr.cost
      ) order by rr.created_at) as redemption_arr
    from public.reward_redemptions rr
    join public.reward_catalog rc on rc.id = rr.reward_id
    join day_bounds db on true
    where rr.child_id in (select child_id from kids)
      and rr.created_at >= db.utc_start
      and rr.created_at < db.utc_end
    group by rr.child_id
  ),
  child_balance as (
    select
      pl.child_id,
      coalesce(sum(pl.points_delta), 0)::int as balance
    from public.points_ledger pl
    where pl.child_id in (select child_id from kids)
    group by pl.child_id
  )
  select
    k.child_id,
    k.child_name,
    public.points_earned_for_day(k.child_id, p_date_key, (select tz from fs)) as points_today,
    (select count(*) from completed c where c.child_id = k.child_id)::int as completed_count,
    (select array_agg(ac.title order by ac.title)
       from completed c
       join active_chores ac on ac.chore_id = c.chore_id
      where c.child_id = k.child_id
    ) as completed_chores,
    (select array_agg(ac.title order by ac.title)
       from active_chores ac
      where not exists (
        select 1 from completed c
        where c.child_id = k.child_id and c.chore_id = ac.chore_id
      )
    ) as missed_chores,
    coalesce(cb.bonus_arr, '[]'::jsonb) as bonuses,
    coalesce(cr.redemption_arr, '[]'::jsonb) as redemptions,
    coalesce(cbal.balance, 0) as current_balance
  from kids k
  left join child_bonuses cb on cb.child_id = k.child_id
  left join child_redemptions cr on cr.child_id = k.child_id
  left join child_balance cbal on cbal.child_id = k.child_id
  order by k.child_name;
$$;

grant execute on function public.family_daily_summary(uuid, date) to authenticated;

-- ============================================================
-- 3) Add catalog_version to family_settings
-- ============================================================

alter table if exists public.family_settings
  add column if not exists catalog_version int not null default 0;

-- ============================================================
-- 4) Versioned seed_default_catalog RPC
-- ============================================================
-- Version 1 = original starter catalog (from v5)
-- When catalog_version < LATEST_VERSION, upsert missing items
-- and bump the version. Safe to call repeatedly (idempotent).

create or replace function seed_default_catalog(p_family_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_current_version int;
  v_latest_version constant int := 1;
  v_chore_count int;
  v_reward_count int;
begin
  if not is_family_member(p_family_id) then
    return json_build_object('error', 'Not authorized');
  end if;

  select coalesce(catalog_version, 0) into v_current_version
  from family_settings
  where family_id = p_family_id;

  if v_current_version is null then
    v_current_version := 0;
  end if;

  if v_current_version >= v_latest_version then
    return json_build_object('seeded', false, 'reason', 'Already at latest version', 'version', v_current_version);
  end if;

  -- Version 1: full starter catalog
  if v_current_version < 1 then
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
  end if;

  -- Future versions: add new items here as v_current_version < 2, etc.
  -- Example:
  -- if v_current_version < 2 then
  --   insert into chore_catalog (...) values (...) on conflict do nothing;
  -- end if;

  update family_settings
  set catalog_version = v_latest_version
  where family_id = p_family_id;

  select count(*) into v_chore_count from chore_catalog where family_id = p_family_id;
  select count(*) into v_reward_count from reward_catalog where family_id = p_family_id;

  return json_build_object('seeded', true, 'version', v_latest_version, 'chores', v_chore_count, 'rewards', v_reward_count);
end;
$$;

-- ============================================================
-- 5) Performance index on points_ledger for day queries
-- ============================================================

create index if not exists idx_points_ledger_child_created
  on public.points_ledger (child_id, created_at);

commit;

-- ============================================================
-- DONE! After running this migration:
--   1. Run family_daily_summary(family_id, date) for all summary UIs
--   2. Run points_earned_for_day(child_id, date, tz) for per-child widgets
--   3. seed_default_catalog is now versioned — bump v_latest_version
--      and add new items in future migrations
--   4. Existing families get catalog_version=0 and will be upgraded
--      on next login via ensureCatalogSeeded()
-- ============================================================
