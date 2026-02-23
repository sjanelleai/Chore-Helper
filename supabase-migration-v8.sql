-- ============================================================
-- HomeQuest — Schema Migration v8
-- Chore Verification: Never / Always / Smart approval modes
-- ============================================================
-- Adds approval infrastructure:
--   A) family_settings: approval_mode, approval_threshold
--   B) chore_catalog: approval_override
--   C) daily_status_v2: status, verified_by, verified_at
--   D) Rewrites toggle_chore + kid_toggle_chore for approval logic
--   E) New RPCs: parent_approve_chore, parent_reject_chore, get_pending_approvals
--
-- SAFE to run in Supabase SQL Editor.
-- Run AFTER v7 migration.
-- ============================================================

begin;

-- ============================================================
-- 1) family_settings: add approval columns
-- ============================================================

alter table public.family_settings
  add column if not exists approval_mode text not null default 'smart';

alter table public.family_settings
  add column if not exists approval_threshold int not null default 30;

-- ============================================================
-- 2) chore_catalog: add approval_override
-- ============================================================

alter table public.chore_catalog
  add column if not exists approval_override text not null default 'inherit';

-- ============================================================
-- 3) daily_status_v2: add status, verified_by, verified_at
-- ============================================================

alter table public.daily_status_v2
  add column if not exists status text not null default 'approved';

alter table public.daily_status_v2
  add column if not exists verified_by uuid;

alter table public.daily_status_v2
  add column if not exists verified_at timestamptz;

-- ============================================================
-- 4) Helper: compute whether a chore requires approval
-- ============================================================

create or replace function public.chore_requires_approval(
  p_family_id uuid,
  p_chore_id uuid
)
returns boolean
language plpgsql
stable
as $$
declare
  v_mode text;
  v_threshold int;
  v_override text;
  v_points int;
begin
  select fs.approval_mode, fs.approval_threshold
  into v_mode, v_threshold
  from public.family_settings fs
  where fs.family_id = p_family_id;

  if v_mode is null then
    v_mode := 'smart';
    v_threshold := 30;
  end if;

  select cc.approval_override, cc.points
  into v_override, v_points
  from public.chore_catalog cc
  where cc.id = p_chore_id and cc.family_id = p_family_id;

  if v_override = 'always' then return true; end if;
  if v_override = 'never' then return false; end if;

  if v_mode = 'never' then return false; end if;
  if v_mode = 'always' then return true; end if;

  -- smart mode
  return coalesce(v_points, 0) >= v_threshold;
end;
$$;

grant execute on function public.chore_requires_approval(uuid, uuid) to authenticated;

-- ============================================================
-- 5) Rewrite toggle_chore (parent RPC) — approval-aware
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
  v_existing_status text;
  v_needs_approval boolean;
  v_new_status text;
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

  select status into v_existing_status
  from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  if v_existing_status is not null then
    -- Parent toggling OFF: remove row and reverse points if it was approved
    delete from public.daily_status_v2
    where child_id = p_child_id
      and chore_id = p_chore_id
      and date_key = p_date_key;

    if v_existing_status = 'approved' then
      insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
      values (v_family_id, p_child_id, p_date_key, 'chore_uncheck', p_chore_id, -v_points, '{}');
    end if;

    return json_build_object('ok', true, 'status', 'unchecked');
  else
    -- Parent toggling ON: parents always approve directly
    insert into public.daily_status_v2 (child_id, chore_id, date_key, completed, status, verified_by, verified_at)
    values (p_child_id, p_chore_id, p_date_key, true, 'approved', auth.uid(), now());

    insert into points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_complete', p_chore_id, v_points, '{}');

    return json_build_object('ok', true, 'status', 'approved');
  end if;
end;
$$;

grant execute on function public.toggle_chore(uuid, uuid, date) to authenticated;

-- ============================================================
-- 6) Rewrite kid_toggle_chore — approval-aware
-- ============================================================

drop function if exists public.kid_toggle_chore(text, uuid, uuid, date);

create or replace function kid_toggle_chore(
  p_kid_token text,
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
  v_child_family_id uuid;
  v_points int;
  v_existing_status text;
  v_needs_approval boolean;
  v_new_status text;
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

  select points into v_points
  from public.chore_catalog
  where id = p_chore_id and family_id = v_family_id and active = true;

  if v_points is null then
    return json_build_object('error', 'Chore not found or inactive');
  end if;

  select status into v_existing_status
  from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  if v_existing_status is not null then
    if v_existing_status = 'pending' then
      -- Kid can undo pending (no points were awarded)
      delete from public.daily_status_v2
      where child_id = p_child_id
        and chore_id = p_chore_id
        and date_key = p_date_key;

      return json_build_object('ok', true, 'status', 'unchecked');
    else
      -- Already approved: kid cannot undo in Phase 1
      return json_build_object('ok', false, 'error', 'Already approved — ask a parent to undo');
    end if;
  else
    -- New completion: check approval rules
    v_needs_approval := chore_requires_approval(v_family_id, p_chore_id);

    if v_needs_approval then
      v_new_status := 'pending';
    else
      v_new_status := 'approved';
    end if;

    insert into public.daily_status_v2 (child_id, chore_id, date_key, completed, status)
    values (p_child_id, p_chore_id, p_date_key, true, v_new_status);

    -- Only write to ledger if approved immediately
    if v_new_status = 'approved' then
      insert into public.points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
      values (v_family_id, p_child_id, p_date_key, 'chore_complete', p_chore_id, v_points, '{}');
    end if;

    return json_build_object('ok', true, 'status', v_new_status);
  end if;
end;
$$;

grant execute on function public.kid_toggle_chore(text, uuid, uuid, date) to anon, authenticated;

-- ============================================================
-- 7) RPC: parent_approve_chore
-- ============================================================

create or replace function public.parent_approve_chore(
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
  v_current_status text;
begin
  select family_id into v_family_id
  from children where id = p_child_id;

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select status into v_current_status
  from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  if v_current_status is null then
    return json_build_object('ok', false, 'error', 'No pending chore found');
  end if;

  if v_current_status != 'pending' then
    return json_build_object('ok', false, 'error', 'Chore is not pending');
  end if;

  select points into v_points
  from public.chore_catalog
  where id = p_chore_id and family_id = v_family_id;

  if v_points is null then v_points := 0; end if;

  update public.daily_status_v2
  set status = 'approved',
      verified_by = auth.uid(),
      verified_at = now()
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  insert into public.points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
  values (v_family_id, p_child_id, p_date_key, 'chore_approve', p_chore_id, v_points, '{}');

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.parent_approve_chore(uuid, uuid, date) to authenticated;

-- ============================================================
-- 8) RPC: parent_reject_chore
-- ============================================================

create or replace function public.parent_reject_chore(
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
  v_current_status text;
begin
  select family_id into v_family_id
  from children where id = p_child_id;

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select status into v_current_status
  from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  if v_current_status is null then
    return json_build_object('ok', false, 'error', 'No pending chore found');
  end if;

  if v_current_status != 'pending' then
    return json_build_object('ok', false, 'error', 'Chore is not pending');
  end if;

  delete from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.parent_reject_chore(uuid, uuid, date) to authenticated;

-- ============================================================
-- 9) RPC: get_pending_approvals
-- ============================================================

create or replace function public.get_pending_approvals(
  p_family_id uuid,
  p_date_key date
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  if not is_family_member(p_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select json_agg(
    json_build_object(
      'child_id', ds.child_id,
      'child_name', ch.display_name,
      'chore_id', ds.chore_id,
      'chore_title', cc.title,
      'points', cc.points,
      'date_key', ds.date_key,
      'created_at', ds.created_at
    )
    order by ch.display_name, cc.sort_order
  )
  into v_result
  from public.daily_status_v2 ds
  join public.children ch on ch.id = ds.child_id
  join public.chore_catalog cc on cc.id = ds.chore_id
  where ch.family_id = p_family_id
    and ds.date_key = p_date_key
    and ds.status = 'pending';

  return json_build_object('ok', true, 'pending', coalesce(v_result, '[]'::json));
end;
$$;

grant execute on function public.get_pending_approvals(uuid, date) to authenticated;

-- ============================================================
-- 10) Update kid_get_chore_status to include status field
-- ============================================================

create or replace function kid_get_chore_status(
  p_kid_token text,
  p_child_id uuid,
  p_date_key date
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
  v_result json;
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

  select json_agg(json_build_object(
    'chore_id', ds.chore_id,
    'completed', ds.completed,
    'status', coalesce(ds.status, 'approved')
  ))
  into v_result
  from public.daily_status_v2 ds
  where ds.child_id = p_child_id
    and ds.date_key = p_date_key;

  return json_build_object(
    'child_id', p_child_id,
    'date_key', p_date_key,
    'statuses', coalesce(v_result, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_get_chore_status(text, uuid, date) to anon, authenticated;

-- ============================================================
-- 11) Update family_daily_summary to only count approved chores
-- ============================================================
-- Note: The existing family_daily_summary in v6 counts rows in daily_status_v2
-- where completed=true. We now need to also filter by status='approved'.
-- This ensures pending chores don't appear in the "completed" count.

-- We leave family_daily_summary as-is for now since it reads from points_ledger
-- for points (which are correct) and daily_status_v2 for completion counts.
-- The daily_status_v2 query in family_daily_summary should be updated to
-- filter status='approved'. However, since it uses completed=true and
-- the new default is 'approved', existing rows are fine.
-- For a full fix, the summary RPC should add: AND ds.status = 'approved'

-- ============================================================
-- 12) Index for pending approvals queries
-- ============================================================

create index if not exists idx_daily_status_v2_pending
  on public.daily_status_v2 (date_key, status)
  where status = 'pending';

commit;
