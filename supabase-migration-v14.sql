-- ============================================================
-- Migration v14: Security + data integrity fixes
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) HIGH-7: New server-side child PIN verification RPC
--    Eliminates fetching the bcrypt hash to the browser.
--    Called from SelectChild.tsx (parent switching active child).
create or replace function verify_child_pin(
  p_child_id uuid,
  p_pin      text
)
returns json
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  select child_pin_hash into v_hash
  from public.children
  where id = p_child_id;

  -- No PIN set — allow without verification
  if v_hash is null then
    return json_build_object('ok', true);
  end if;

  if v_hash = crypt(p_pin, v_hash) then
    return json_build_object('ok', true);
  else
    return json_build_object('ok', false, 'error', 'wrong_pin');
  end if;
end;
$$;

grant execute on function public.verify_child_pin(uuid, text) to authenticated;


-- 2) HIGH-8: Fix verify_kid_join — bind the session to the child
--    whose PIN was used, returning only that child.
--    Prevents Child A from entering their PIN and switching to Child B.
create or replace function verify_kid_join(
  p_family_number text,
  p_pin           text
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id  uuid;
  v_child_id   uuid;
  v_child_name text;
  v_token      text;
begin
  select f.id into v_family_id
  from public.families f
  where f.family_number = upper(trim(p_family_number));

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'family_not_found');
  end if;

  -- Find the specific child whose PIN matches (not just any child)
  select c.id, c.display_name into v_child_id, v_child_name
  from public.children c
  where c.family_id = v_family_id
    and c.child_pin_hash is not null
    and c.child_pin_hash = crypt(p_pin, c.child_pin_hash)
  order by c.created_at
  limit 1;

  if v_child_id is null then
    return json_build_object('ok', false, 'error', 'invalid_pin');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  -- Session is pre-bound to the verified child
  insert into public.kid_sessions (kid_token, family_id, child_id, expires_at)
  values (v_token, v_family_id, v_child_id, now() + interval '24 hours');

  return json_build_object(
    'ok',         true,
    'family_id',  v_family_id,
    'kid_token',  v_token,
    'child_id',   v_child_id,
    'child_name', v_child_name
  );
end;
$$;

grant execute on function public.verify_kid_join(text, text) to anon, authenticated;


-- 3) HIGH-3: Fix kid_get_catalog to return 'requires_parent_approval'
--    matching the TypeScript RewardCatalogItem type
create or replace function kid_get_catalog(p_kid_token text)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_chores    json;
  v_rewards   json;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session'
      using hint = 'Re-join using Family Number + PIN';
  end if;

  select json_agg(json_build_object(
    'id',         cc.id,
    'family_id',  cc.family_id,
    'category',   cc.category,
    'title',      cc.title,
    'points',     cc.points,
    'active',     cc.active,
    'sort_order', cc.sort_order
  ) order by cc.sort_order)
  into v_chores
  from public.chore_catalog cc
  where cc.family_id = v_family_id;

  select json_agg(json_build_object(
    'id',                     rc.id,
    'family_id',              rc.family_id,
    'category',               rc.category,
    'title',                  rc.title,
    'cost',                   rc.cost,
    'requires_parent_approval', rc.requires_approval,
    'active',                 rc.active,
    'sort_order',             rc.sort_order
  ) order by rc.sort_order)
  into v_rewards
  from public.reward_catalog rc
  where rc.family_id = v_family_id;

  return json_build_object(
    'chores',  coalesce(v_chores,  '[]'::json),
    'rewards', coalesce(v_rewards, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_get_catalog(text) to anon, authenticated;


-- 4) HIGH-6: Unique constraint on child_badges prevents duplicate badge rows
--    from the race condition in checkAndAwardBadges.
--    Create the table if it doesn't exist yet (idempotent).
create table if not exists public.child_badges (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.children(id) on delete cascade,
  badge_key  text not null,
  badge_name text not null,
  badge_icon text not null,
  threshold  int  not null,
  earned_at  timestamptz not null default now()
);

alter table public.child_badges
  drop constraint if exists uq_child_badges_child_key;

-- Also drop the unnamed unique constraint if it came from the base migration
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.child_badges'::regclass
    and contype = 'u'
    and conname != 'uq_child_badges_child_key';
  if v_conname is not null then
    execute 'alter table public.child_badges drop constraint ' || quote_ident(v_conname);
  end if;
end $$;

alter table public.child_badges
  add constraint uq_child_badges_child_key unique (child_id, badge_key);


-- 5) MED-8: Fix family_daily_summary to count only approved chores
--    (was counting all chores where completed=true, including pending)
--    Drop and recreate the function with the status filter.
drop function if exists public.family_daily_summary(uuid, date);

create or replace function family_daily_summary(
  p_family_id uuid,
  p_date_key  date
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(summary)) into v_result
  from (
    select
      c.id                                                          as child_id,
      c.display_name                                                as child_name,
      count(ds.chore_id) filter (
        where ds.completed = true
          and coalesce(ds.status, 'approved') = 'approved'
      )                                                             as completed_count,
      count(cc.id) filter (where cc.active = true)                 as total_count,
      coalesce(sum(pl.points_delta) filter (where pl.points_delta > 0), 0) as points_earned
    from public.children c
    left join public.chore_catalog cc
      on cc.family_id = c.family_id and cc.active = true
    left join public.daily_status_v2 ds
      on ds.child_id = c.id and ds.chore_id = cc.id and ds.date_key = p_date_key
    left join public.points_ledger pl
      on pl.child_id = c.id and pl.date_key = p_date_key and pl.points_delta > 0
    where c.family_id = p_family_id
    group by c.id, c.display_name
    order by c.created_at
  ) summary;

  return json_build_object(
    'ok',       true,
    'date_key', p_date_key,
    'children', coalesce(v_result, '[]'::json)
  );
end;
$$;

grant execute on function public.family_daily_summary(uuid, date) to authenticated;
