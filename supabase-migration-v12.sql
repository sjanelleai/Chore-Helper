-- ============================================================
-- Migration v12: kid_check_badges RPC
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- RPC: kid_check_badges(p_kid_token, p_child_id)
-- Called after a kid toggles a chore to auto-completion.
-- Awards any newly-unlocked badges and returns them.
create or replace function kid_check_badges(
  p_kid_token text,
  p_child_id  uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id       uuid;
  v_lifetime_points int;
  v_new_badges      json;
begin
  -- Validate token
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'Invalid or expired session');
  end if;

  -- Verify child belongs to this family
  if not exists (
    select 1 from public.children
    where id = p_child_id and family_id = v_family_id
  ) then
    return json_build_object('ok', false, 'error', 'Child not in family');
  end if;

  -- Calculate lifetime points (sum of all positive deltas)
  select coalesce(sum(points_delta), 0) into v_lifetime_points
  from public.points_ledger
  where child_id = p_child_id
    and points_delta > 0;

  -- Insert any newly-unlocked badges (skip already-earned ones)
  insert into public.child_badges (child_id, badge_key, badge_name, badge_icon, threshold)
  select
    p_child_id,
    b.badge_key,
    b.badge_name,
    b.badge_icon,
    b.threshold
  from (values
    ('starter',  'Starter Badge',  'medal_bronze', 50),
    ('helper2',  'Helper Level 2', 'medal_silver',  150),
    ('master',   'Chore Master',   'medal_gold',    300),
    ('star',     'Super Star',     'star',          500),
    ('champion', 'Champion',       'trophy',        1000),
    ('legend',   'Legend',         'crown',         2000)
  ) as b(badge_key, badge_name, badge_icon, threshold)
  where b.threshold <= v_lifetime_points
    and not exists (
      select 1 from public.child_badges cb
      where cb.child_id = p_child_id
        and cb.badge_key = b.badge_key
    );

  -- Return newly awarded badges
  select json_agg(json_build_object(
    'key',       cb.badge_key,
    'name',      cb.badge_name,
    'icon',      cb.badge_icon,
    'threshold', cb.threshold
  ))
  into v_new_badges
  from public.child_badges cb
  where cb.child_id = p_child_id
    and cb.earned_at >= now() - interval '5 seconds';

  return json_build_object(
    'ok',         true,
    'new_badges', coalesce(v_new_badges, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_check_badges(text, uuid) to anon, authenticated;
