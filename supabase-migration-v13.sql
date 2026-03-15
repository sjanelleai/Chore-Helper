-- ============================================================
-- Migration v13: Fix kid_redeem_reward + chore_approve event type
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Extend points_ledger event_type constraint to include 'chore_approve'
--    (v8 parent_approve_chore RPC inserts this event type but v3/v11 never
--    added it to the allowlist, causing every parent approval to fail)
alter table points_ledger
  drop constraint if exists points_ledger_event_type_check;

alter table points_ledger
  add constraint points_ledger_event_type_check
  check (event_type in (
    'chore_complete',
    'chore_uncheck',
    'bonus',
    'purchase',
    'manual_adjust',
    'deduction',
    'redeem',
    'chore_approve'
  ));

-- 2) Fix kid_redeem_reward: INSERT was missing family_id (NOT NULL column)
--    causing every kid reward redemption to fail with a constraint error
create or replace function kid_redeem_reward(
  p_kid_token text,
  p_child_id  uuid,
  p_reward_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id      uuid;
  v_child_family_id uuid;
  v_cost           int;
  v_balance        int;
  v_redemption_id  uuid;
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
