-- ============================================================
-- HomeQuest — Schema Migration v3: Supabase-First Architecture
-- ============================================================
-- Moves ALL app state to Supabase:
--   - chore_catalog & reward_catalog (replace frontend-only constants)
--   - daily_status (per-child, per-day chore completion)
--   - points_ledger (auditable points, replaces child_points + ledger_events)
--   - reward_redemptions (replaces purchases)
--   - RPCs for all mutations (toggle_chore, redeem_reward, grant_bonus, etc.)
--
-- SAFE to run multiple times (idempotent).
-- Run in: Supabase Dashboard > SQL Editor > New Query > paste > Run
-- ============================================================

-- ============================================================
-- 0) HELPER: is_family_member() + current_family_id()
-- ============================================================

create or replace function is_family_member(p_family_id uuid)
returns boolean
language sql stable
security definer
as $$
  select exists (
    select 1 from family_members
    where user_id = auth.uid() and family_id = p_family_id
  )
$$;

create or replace function current_family_id()
returns uuid
language sql stable
security definer
as $$
  select family_id from family_members where user_id = auth.uid() limit 1
$$;

-- ============================================================
-- 1) TABLE: chore_catalog
-- ============================================================

create table if not exists chore_catalog (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  category text not null,
  name text not null,
  points int not null default 10,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'chore_catalog_family_category_name_key'
  ) then
    alter table chore_catalog add constraint chore_catalog_family_category_name_key
      unique (family_id, category, name);
  end if;
end $$;

create index if not exists idx_chore_catalog_family on chore_catalog(family_id);
create index if not exists idx_chore_catalog_family_active on chore_catalog(family_id, active);

alter table chore_catalog enable row level security;

do $$ begin
  drop policy if exists "chore_catalog_select" on chore_catalog;
  drop policy if exists "chore_catalog_insert" on chore_catalog;
  drop policy if exists "chore_catalog_update" on chore_catalog;
  drop policy if exists "chore_catalog_delete" on chore_catalog;
end $$;

create policy "chore_catalog_select" on chore_catalog
  for select using (is_family_member(family_id));
create policy "chore_catalog_insert" on chore_catalog
  for insert with check (is_family_member(family_id));
create policy "chore_catalog_update" on chore_catalog
  for update using (is_family_member(family_id));
create policy "chore_catalog_delete" on chore_catalog
  for delete using (is_family_member(family_id));

-- ============================================================
-- 2) TABLE: reward_catalog
-- ============================================================

create table if not exists reward_catalog (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  category text not null,
  name text not null,
  cost int not null,
  requires_approval boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'reward_catalog_family_category_name_key'
  ) then
    alter table reward_catalog add constraint reward_catalog_family_category_name_key
      unique (family_id, category, name);
  end if;
end $$;

create index if not exists idx_reward_catalog_family on reward_catalog(family_id);
create index if not exists idx_reward_catalog_family_active on reward_catalog(family_id, active);

alter table reward_catalog enable row level security;

do $$ begin
  drop policy if exists "reward_catalog_select" on reward_catalog;
  drop policy if exists "reward_catalog_insert" on reward_catalog;
  drop policy if exists "reward_catalog_update" on reward_catalog;
  drop policy if exists "reward_catalog_delete" on reward_catalog;
end $$;

create policy "reward_catalog_select" on reward_catalog
  for select using (is_family_member(family_id));
create policy "reward_catalog_insert" on reward_catalog
  for insert with check (is_family_member(family_id));
create policy "reward_catalog_update" on reward_catalog
  for update using (is_family_member(family_id));
create policy "reward_catalog_delete" on reward_catalog
  for delete using (is_family_member(family_id));

-- ============================================================
-- 3) TABLE: daily_status (recreate for new schema)
-- ============================================================
-- Old daily_status used an `id serial` PK and `completed_chores jsonb`.
-- New schema uses composite PK (child_id, date_key) and completed_chore_ids uuid[].
-- We drop the old table if it exists and recreate.

drop table if exists daily_status cascade;

create table daily_status (
  child_id uuid not null references children(id) on delete cascade,
  date_key date not null,
  completed_chore_ids uuid[] not null default '{}',
  points_earned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (child_id, date_key)
);

create index if not exists idx_daily_status_date on daily_status(date_key);
create index if not exists idx_daily_status_child on daily_status(child_id);

alter table daily_status enable row level security;

do $$ begin
  drop policy if exists "daily_status_select" on daily_status;
  drop policy if exists "daily_status_insert" on daily_status;
  drop policy if exists "daily_status_update" on daily_status;
end $$;

create policy "daily_status_select" on daily_status
  for select using (
    is_family_member((select family_id from children where id = child_id))
  );
create policy "daily_status_insert" on daily_status
  for insert with check (
    is_family_member((select family_id from children where id = child_id))
  );
create policy "daily_status_update" on daily_status
  for update using (
    is_family_member((select family_id from children where id = child_id))
  );

-- ============================================================
-- 4) TABLE: points_ledger
-- ============================================================

create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  date_key date not null,
  event_type text not null check (event_type in ('chore_complete','chore_uncheck','bonus','purchase','manual_adjust')),
  ref_id uuid,
  points_delta int not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_points_ledger_family_date on points_ledger(family_id, date_key);
create index if not exists idx_points_ledger_child_date on points_ledger(child_id, date_key);
create index if not exists idx_points_ledger_family_created on points_ledger(family_id, created_at desc);

alter table points_ledger enable row level security;

do $$ begin
  drop policy if exists "points_ledger_select" on points_ledger;
  drop policy if exists "points_ledger_insert" on points_ledger;
end $$;

create policy "points_ledger_select" on points_ledger
  for select using (is_family_member(family_id));
create policy "points_ledger_insert" on points_ledger
  for insert with check (is_family_member(family_id));

-- ============================================================
-- 5) TABLE: reward_redemptions
-- ============================================================

create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  reward_id uuid not null references reward_catalog(id) on delete cascade,
  cost int not null,
  status text not null default 'requested' check (status in ('requested','approved','denied','fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reward_redemptions_family on reward_redemptions(family_id, created_at desc);
create index if not exists idx_reward_redemptions_child on reward_redemptions(child_id, created_at desc);

alter table reward_redemptions enable row level security;

do $$ begin
  drop policy if exists "reward_redemptions_select" on reward_redemptions;
  drop policy if exists "reward_redemptions_insert" on reward_redemptions;
  drop policy if exists "reward_redemptions_update" on reward_redemptions;
end $$;

create policy "reward_redemptions_select" on reward_redemptions
  for select using (is_family_member(family_id));
create policy "reward_redemptions_insert" on reward_redemptions
  for insert with check (is_family_member(family_id));
create policy "reward_redemptions_update" on reward_redemptions
  for update using (is_family_member(family_id));

-- ============================================================
-- 6) VIEW: child_points_view (derived from points_ledger)
-- ============================================================

create or replace view child_points_view as
select
  child_id,
  coalesce(sum(points_delta), 0)::int as points,
  coalesce(sum(case when points_delta > 0 then points_delta else 0 end), 0)::int as lifetime_points
from points_ledger
group by child_id;

-- ============================================================
-- 7) TRIGGERS: auto-update updated_at
-- ============================================================

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  drop trigger if exists trg_chore_catalog_updated on chore_catalog;
  create trigger trg_chore_catalog_updated
    before update on chore_catalog
    for each row execute function update_updated_at();
exception when others then null;
end $$;

do $$ begin
  drop trigger if exists trg_reward_catalog_updated on reward_catalog;
  create trigger trg_reward_catalog_updated
    before update on reward_catalog
    for each row execute function update_updated_at();
exception when others then null;
end $$;

do $$ begin
  drop trigger if exists trg_daily_status_updated on daily_status;
  create trigger trg_daily_status_updated
    before update on daily_status
    for each row execute function update_updated_at();
exception when others then null;
end $$;

do $$ begin
  drop trigger if exists trg_reward_redemptions_updated on reward_redemptions;
  create trigger trg_reward_redemptions_updated
    before update on reward_redemptions
    for each row execute function update_updated_at();
exception when others then null;
end $$;

-- ============================================================
-- 8) RPC: ensure_family_exists (lean — no catalog seeding)
-- ============================================================

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

  select family_id into v_existing_family_id
  from family_members
  where user_id = v_user_id;

  if v_existing_family_id is not null then
    select name into v_display_name from families where id = v_existing_family_id;
    return json_build_object(
      'family_id', v_existing_family_id,
      'display_name', coalesce(v_display_name, p_display_name)
    );
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  select id into v_family_id from families where owner_user_id = v_user_id limit 1;

  if v_family_id is null then
    insert into families (owner_user_id, name)
    values (v_user_id, coalesce(p_display_name, 'My Family'))
    returning id into v_family_id;
  end if;

  insert into family_members (user_id, family_id, role)
  values (v_user_id, v_family_id, 'parent')
  on conflict (user_id) do nothing;

  insert into family_settings (family_id, primary_parent_email)
  values (v_family_id, v_user_email)
  on conflict (family_id) do nothing;

  return json_build_object('family_id', v_family_id, 'display_name', coalesce(p_display_name, 'Parent'));
end;
$$;

-- ============================================================
-- 9) RPC: add_child(p_display_name)
-- ============================================================

create or replace function add_child(p_display_name text)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_id uuid;
begin
  select family_id into v_family_id
  from family_members where user_id = auth.uid();

  if v_family_id is null then
    return json_build_object('error', 'No family found');
  end if;

  insert into children (family_id, display_name)
  values (v_family_id, p_display_name)
  returning id into v_child_id;

  return json_build_object(
    'id', v_child_id,
    'family_id', v_family_id,
    'display_name', p_display_name
  );
end;
$$;

-- ============================================================
-- 10) RPC: toggle_chore(p_child_id, p_chore_id, p_date_key)
-- ============================================================

create or replace function toggle_chore(p_child_id uuid, p_chore_id uuid, p_date_key date)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_chore_ids uuid[];
  v_was_done boolean;
  v_points int;
  v_daily_earned int;
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

  insert into daily_status (child_id, date_key, completed_chore_ids, points_earned)
  values (p_child_id, p_date_key, '{}', 0)
  on conflict (child_id, date_key) do nothing;

  select completed_chore_ids into v_chore_ids
  from daily_status
  where child_id = p_child_id and date_key = p_date_key;

  v_was_done := p_chore_id = any(v_chore_ids);

  if v_was_done then
    v_chore_ids := array_remove(v_chore_ids, p_chore_id);

    insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_uncheck', p_chore_id, -v_points, '{}');
  else
    v_chore_ids := array_append(v_chore_ids, p_chore_id);

    insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_complete', p_chore_id, v_points, '{}');
  end if;

  v_daily_earned := coalesce((
    select sum(points_delta)
    from points_ledger
    where child_id = p_child_id and date_key = p_date_key
      and event_type in ('chore_complete', 'chore_uncheck')
  ), 0);

  update daily_status
  set completed_chore_ids = v_chore_ids,
      points_earned = v_daily_earned
  where child_id = p_child_id and date_key = p_date_key;

  return json_build_object(
    'child_id', p_child_id,
    'date_key', p_date_key,
    'completed_chore_ids', v_chore_ids,
    'points_earned', v_daily_earned,
    'toggled_chore_id', p_chore_id,
    'was_completed', not v_was_done,
    'points_delta', case when v_was_done then -v_points else v_points end
  );
end;
$$;

-- ============================================================
-- 11) RPC: redeem_reward(p_child_id, p_reward_id)
-- ============================================================

create or replace function redeem_reward(p_child_id uuid, p_reward_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_reward_name text;
  v_cost int;
  v_current_points int;
  v_redemption_id uuid;
  v_today date;
begin
  select family_id into v_family_id
  from children where id = p_child_id;

  if v_family_id is null then
    return json_build_object('error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('error', 'Not authorized');
  end if;

  select name, cost into v_reward_name, v_cost
  from reward_catalog
  where id = p_reward_id and family_id = v_family_id and active = true;

  if v_reward_name is null then
    return json_build_object('error', 'Reward not found or inactive');
  end if;

  select coalesce(sum(points_delta), 0) into v_current_points
  from points_ledger
  where child_id = p_child_id;

  if v_current_points < v_cost then
    return json_build_object('error', 'Not enough points', 'current_points', v_current_points, 'cost', v_cost);
  end if;

  v_today := current_date;

  insert into reward_redemptions (family_id, child_id, reward_id, cost, status)
  values (v_family_id, p_child_id, p_reward_id, v_cost, 'fulfilled')
  returning id into v_redemption_id;

  insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
  values (v_family_id, p_child_id, v_today, 'purchase', p_reward_id, -v_cost,
    json_build_object('reward_name', v_reward_name, 'redemption_id', v_redemption_id)::jsonb);

  return json_build_object(
    'redemption_id', v_redemption_id,
    'reward_name', v_reward_name,
    'cost', v_cost,
    'new_points', v_current_points - v_cost
  );
end;
$$;

-- ============================================================
-- 12) RPC: grant_bonus(p_child_id, p_points, p_reason)
-- ============================================================

create or replace function grant_bonus(p_child_id uuid, p_points int, p_reason text)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_new_total int;
  v_today date;
begin
  select family_id into v_family_id
  from children where id = p_child_id;

  if v_family_id is null then
    return json_build_object('error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('error', 'Not authorized');
  end if;

  if p_points < 1 or p_points > 5000 then
    return json_build_object('error', 'Points must be between 1 and 5000');
  end if;

  v_today := current_date;

  insert into points_ledger (family_id, child_id, date_key, event_type, points_delta, meta)
  values (v_family_id, p_child_id, v_today, 'bonus', p_points,
    json_build_object('reason', p_reason)::jsonb);

  select coalesce(sum(points_delta), 0) into v_new_total
  from points_ledger
  where child_id = p_child_id;

  return json_build_object(
    'child_id', p_child_id,
    'points_awarded', p_points,
    'reason', p_reason,
    'new_total', v_new_total
  );
end;
$$;

-- ============================================================
-- 13) RPC: seed_default_catalog(p_family_id)
-- ============================================================
-- Separate from ensure_family_exists — called explicitly when
-- chore_catalog is empty for a family. Idempotent.

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

  insert into chore_catalog (family_id, category, name, points, active, sort_order) values
    (p_family_id, 'Room', 'Make bed', 15, true, 1),
    (p_family_id, 'Room', 'Put clothes in hamper', 15, true, 2),
    (p_family_id, 'Room', 'Pick up floor', 20, true, 3),
    (p_family_id, 'Room', 'Tidy desk', 20, false, 4),
    (p_family_id, 'Room', 'Clean room (quick)', 35, false, 5),
    (p_family_id, 'Room', 'Clean room (deep)', 120, false, 6),
    (p_family_id, 'Kitchen', 'Clear your plate', 15, false, 7),
    (p_family_id, 'Kitchen', 'Load dishwasher', 30, false, 8),
    (p_family_id, 'Kitchen', 'Unload dishwasher', 40, false, 9),
    (p_family_id, 'Kitchen', 'Wipe counters', 35, false, 10),
    (p_family_id, 'Kitchen', 'Set the table', 20, false, 11),
    (p_family_id, 'Pets', 'Feed pet', 20, true, 12),
    (p_family_id, 'Pets', 'Water bowl', 15, false, 13),
    (p_family_id, 'Pets', 'Help with pet cleanup', 40, false, 14),
    (p_family_id, 'School', 'Homework (15 min)', 25, true, 15),
    (p_family_id, 'School', 'Homework (30 min)', 50, false, 16),
    (p_family_id, 'School', 'Reading (15 min)', 25, false, 17),
    (p_family_id, 'School', 'Pack backpack', 20, true, 18),
    (p_family_id, 'Family', 'Help sibling (kindly)', 25, false, 19),
    (p_family_id, 'Family', 'Take out small trash', 25, false, 20),
    (p_family_id, 'Family', 'Laundry helper', 40, false, 21)
  on conflict (family_id, category, name) do nothing;

  insert into reward_catalog (family_id, category, name, cost, requires_approval, active, sort_order) values
    (p_family_id, 'Privileges', 'Pick music in the car', 700, false, true, 1),
    (p_family_id, 'Privileges', 'Pick a family game', 650, false, false, 2),
    (p_family_id, 'Privileges', 'Extra screen time +15 min', 1200, true, true, 3),
    (p_family_id, 'Privileges', 'Extra screen time +30 min', 2000, true, false, 4),
    (p_family_id, 'Privileges', 'Stay up +15 min', 1400, true, true, 5),
    (p_family_id, 'Privileges', 'Stay up +30 min', 2400, true, false, 6),
    (p_family_id, 'Privileges', 'Stay up +60 min (VERY expensive)', 4500, true, false, 7),
    (p_family_id, 'Experiences', 'Ice cream outing', 2200, true, false, 8),
    (p_family_id, 'Experiences', 'Movie night (pick the movie)', 2600, true, true, 9),
    (p_family_id, 'Experiences', 'Arcade trip', 3500, true, true, 10),
    (p_family_id, 'Experiences', 'Bowling night', 4200, true, false, 11),
    (p_family_id, 'Experiences', 'Friend playdate', 3000, true, false, 12),
    (p_family_id, 'Food Treats', 'Special dessert', 1200, false, true, 13),
    (p_family_id, 'Food Treats', 'Smoothie / fancy drink', 1500, false, false, 14),
    (p_family_id, 'Food Treats', 'Pick dinner (within rules)', 3200, true, false, 15),
    (p_family_id, 'Toys / Items', 'Small toy / trinket', 3000, true, false, 16),
    (p_family_id, 'Toys / Items', 'New book', 4200, true, false, 17),
    (p_family_id, 'Toys / Items', 'Bigger toy (rare)', 9000, true, false, 18)
  on conflict (family_id, category, name) do nothing;

  select count(*) into v_chore_count from chore_catalog where family_id = p_family_id;
  select count(*) into v_reward_count from reward_catalog where family_id = p_family_id;

  return json_build_object('seeded', true, 'chores', v_chore_count, 'rewards', v_reward_count);
end;
$$;

-- ============================================================
-- 14) GRANTS
-- ============================================================

grant execute on function is_family_member(uuid) to authenticated;
grant execute on function current_family_id() to authenticated;
grant execute on function ensure_family_exists(text) to authenticated;
grant execute on function add_child(text) to authenticated;
grant execute on function toggle_chore(uuid, uuid, date) to authenticated;
grant execute on function redeem_reward(uuid, uuid) to authenticated;
grant execute on function grant_bonus(uuid, int, text) to authenticated;
grant execute on function seed_default_catalog(uuid) to authenticated;

-- ============================================================
-- DONE! Run this in Supabase SQL Editor, then deploy frontend.
-- ============================================================
