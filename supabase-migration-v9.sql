-- ============================================================
-- HomeQuest — Schema Migration v9
-- Fix: Ensure daily_status_v2 is readable by authenticated parents
-- ============================================================
-- Ensures RLS policies and grants are correct so that
-- parent-mode PostgREST queries can SELECT from daily_status_v2.
--
-- SAFE to run multiple times (idempotent).
-- Run in Supabase SQL Editor.
-- ============================================================

begin;

-- 1) Ensure RLS is enabled
alter table public.daily_status_v2 enable row level security;

-- 2) Recreate SELECT policy (idempotent: drop then create)
drop policy if exists daily_status_v2_select_member on public.daily_status_v2;

create policy daily_status_v2_select_member
on public.daily_status_v2
for select
using (
  exists (
    select 1
    from public.children c
    where c.id = daily_status_v2.child_id
      and public.is_family_member(c.family_id)
  )
);

-- 3) Grant SELECT to authenticated role (PostgREST needs this even with RLS)
grant select on public.daily_status_v2 to authenticated;

commit;
