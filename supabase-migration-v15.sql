-- Migration v15: Enable RLS on child_badges table
--
-- The v14 migration created child_badges with CREATE TABLE IF NOT EXISTS but
-- did not apply ENABLE ROW LEVEL SECURITY or policies when it created the
-- table fresh (i.e. on a clean database). This migration idempotently fixes
-- that gap.

-- 1) Enable RLS (safe to run even if already enabled)
alter table public.child_badges enable row level security;

-- 2) Recreate policies (drop first so this migration is re-runnable)
drop policy if exists "child_badges_select" on public.child_badges;
drop policy if exists "child_badges_insert" on public.child_badges;
drop policy if exists "child_badges_delete" on public.child_badges;

create policy "child_badges_select" on public.child_badges
  for select using (
    child_id in (select id from public.children where family_id = current_family_id())
  );

create policy "child_badges_insert" on public.child_badges
  for insert with check (
    child_id in (select id from public.children where family_id = current_family_id())
  );

create policy "child_badges_delete" on public.child_badges
  for delete using (
    child_id in (select id from public.children where family_id = current_family_id())
  );
