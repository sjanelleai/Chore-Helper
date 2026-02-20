-- ============================================================
-- HomeQuest — Schema Migration v4: Email Send Log + Remove Child
-- ============================================================
-- Adds:
--   - email_send_log table for dedupe + history of nightly summary emails
--   - remove_child RPC for deleting a child and all associated data
--   - Recommended indexes for performance
--
-- SAFE to run multiple times (idempotent).
-- Run in: Supabase Dashboard > SQL Editor > New Query > paste > Run
-- ============================================================

-- ============================================================
-- 1) TABLE: email_send_log
-- ============================================================

create table if not exists email_send_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  date_key date not null,
  status text not null default 'pending',
  error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  constraint uq_email_send_log_family_date unique (family_id, date_key)
);

alter table email_send_log enable row level security;

drop policy if exists "Family members can view their email logs" on email_send_log;
create policy "Family members can view their email logs"
  on email_send_log for select
  using (family_id = current_family_id());

-- ============================================================
-- 2) INDEXES (safe, idempotent)
-- ============================================================

create index if not exists idx_children_family_id on children(family_id);
create index if not exists idx_family_settings_family_id on family_settings(family_id);
create index if not exists idx_family_members_user_family on family_members(user_id, family_id);
create index if not exists idx_daily_status_child_date on daily_status(child_id, date_key);
create index if not exists idx_points_ledger_child_created on points_ledger(child_id, created_at);
create index if not exists idx_reward_redemptions_child_created on reward_redemptions(child_id, created_at);
create index if not exists idx_email_send_log_family_date on email_send_log(family_id, date_key);

-- ============================================================
-- 3) RPC: remove_child
-- ============================================================
-- Deletes a child and all associated data (daily_status, points_ledger,
-- reward_redemptions, child_badges). Only callable by a family member.
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

  delete from daily_status where child_id = p_child_id;
  delete from points_ledger where child_id = p_child_id;
  delete from reward_redemptions where child_id = p_child_id;
  delete from child_badges where child_id = p_child_id;
  delete from children where id = p_child_id;

  return jsonb_build_object('ok', true, 'child_id', p_child_id);
end;
$$;
