-- ============================================================
-- Migration v16: Fix mutable search_path on security-definer functions
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================
-- Without a fixed search_path a malicious user could create objects in a
-- schema that shadows public and redirect security-definer functions to
-- attacker-controlled code. Adding SET search_path = public locks each
-- function to the expected schema.
-- ============================================================


-- 1) deduct_points
create or replace function public.deduct_points(
  p_child_id uuid,
  p_points    int,
  p_reason    text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_new_total int;
begin
  select family_id into v_family_id
  from children where id = p_child_id;

  if v_family_id is null then
    return json_build_object('error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('error', 'Not authorized');
  end if;

  if p_points < 1 or p_points > 500 then
    return json_build_object('error', 'Deduction must be between 1 and 500');
  end if;

  insert into points_ledger (family_id, child_id, date_key, event_type, points_delta, meta)
  values (
    v_family_id,
    p_child_id,
    current_date,
    'deduction',
    -p_points,
    json_build_object('reason', p_reason)::jsonb
  );

  select coalesce(sum(points_delta), 0) into v_new_total
  from points_ledger
  where child_id = p_child_id;

  return json_build_object(
    'ok', true,
    'child_id', p_child_id,
    'points_deducted', p_points,
    'reason', p_reason,
    'new_total', v_new_total
  );
end;
$$;

grant execute on function public.deduct_points(uuid, int, text) to authenticated;


-- 2) verify_child_pin
create or replace function public.verify_child_pin(
  p_child_id uuid,
  p_pin      text
)
returns json
language plpgsql
security definer
set search_path = public
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


-- 3) verify_kid_join
create or replace function public.verify_kid_join(
  p_family_number text,
  p_pin           text
)
returns json
language plpgsql
security definer
set search_path = public
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


-- 4) kid_get_catalog
create or replace function public.kid_get_catalog(p_kid_token text)
returns json
language plpgsql
security definer
set search_path = public
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
    'id',                       rc.id,
    'family_id',                rc.family_id,
    'category',                 rc.category,
    'title',                    rc.title,
    'cost',                     rc.cost,
    'requires_parent_approval', rc.requires_approval,
    'active',                   rc.active,
    'sort_order',               rc.sort_order
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


-- 5) kid_redeem_reward
create or replace function public.kid_redeem_reward(
  p_kid_token text,
  p_child_id  uuid,
  p_reward_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id       uuid;
  v_child_family_id uuid;
  v_cost            int;
  v_balance         int;
  v_redemption_id   uuid;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select cost into v_cost
  from public.reward_catalog
  where id = p_reward_id and family_id = v_family_id and active = true;

  if v_cost is null then
    return json_build_object('ok', false, 'error', 'Reward not found or inactive');
  end if;

  select coalesce(sum(points_delta), 0) into v_balance
  from public.points_ledger
  where child_id = p_child_id;

  if v_balance < v_cost then
    return json_build_object('ok', false, 'error', 'Not enough points');
  end if;

  insert into public.reward_redemptions (family_id, child_id, reward_id, cost, status)
  values (v_family_id, p_child_id, p_reward_id, v_cost, 'approved')
  returning id into v_redemption_id;

  insert into public.points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
  values (v_family_id, p_child_id, current_date, 'purchase', p_reward_id, -v_cost, '{}');

  return json_build_object('ok', true, 'redemption_id', v_redemption_id);
end;
$$;

grant execute on function public.kid_redeem_reward(text, uuid, uuid) to anon, authenticated;


-- 6) family_daily_summary
create or replace function public.family_daily_summary(
  p_family_id uuid,
  p_date_key  date
)
returns json
language plpgsql
security definer
set search_path = public
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
