-- ============================================================
-- Migration v11: Add point deduction support
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Extend the event_type check constraint to include 'deduction'
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
    'deduction'
  ));

-- 2) RPC: deduct_points(p_child_id, p_points, p_reason)
--    p_points: positive integer (1–500); stored as negative delta
create or replace function deduct_points(
  p_child_id uuid,
  p_points    int,
  p_reason    text
)
returns json
language plpgsql
security definer
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

grant execute on function deduct_points(uuid, int, text) to authenticated;
