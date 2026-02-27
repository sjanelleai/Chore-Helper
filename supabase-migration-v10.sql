-- ============================================================
-- HomeQuest — Schema Migration v10
-- Daily Summary Email: cron job + schema cleanup
-- ============================================================
-- Sets up the pg_cron scheduled job that calls the
-- nightly-summary-runner Edge Function every 15 minutes.
--
-- PREREQUISITES (do once in Supabase Dashboard):
--   1. Database → Extensions → enable "pg_cron"
--   2. Database → Extensions → enable "pg_net"
--
-- REQUIRED SUPABASE SECRETS (set via CLI or Dashboard):
--   supabase secrets set SENDGRID_API_KEY=<your_sendgrid_api_key>
--   supabase secrets set SENDGRID_FROM_EMAIL=<your_verified_sender@domain.com>
--   supabase secrets set SENDGRID_FROM_NAME="HomeQuest"
--
-- DEPLOY EDGE FUNCTIONS (run from project root):
--   supabase functions deploy nightly-summary-runner
--   supabase functions deploy send-family-summary
--
-- SAFE to run multiple times (idempotent).
-- Run in Supabase SQL Editor AFTER enabling extensions above.
-- ============================================================

begin;

-- ============================================================
-- 1) Ensure family_settings has all required columns
--    (idempotent — adds only if missing)
-- ============================================================

alter table public.family_settings
  add column if not exists daily_summary_enabled boolean not null default false;

alter table public.family_settings
  add column if not exists daily_summary_time_local text not null default '19:30';

alter table public.family_settings
  add column if not exists timezone text not null default 'America/Denver';

-- ============================================================
-- 2) Ensure email_send_log table exists with correct shape
-- ============================================================

create table if not exists public.email_send_log (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  date_key     date not null,
  status       text not null default 'pending',   -- 'pending' | 'sent' | 'failed'
  error        text,
  created_at   timestamptz not null default now(),
  constraint uq_email_send_log_family_date unique (family_id, date_key)
);

-- Enable RLS
alter table public.email_send_log enable row level security;

-- Parents can view their own family's send log
drop policy if exists "Family members can view their email logs" on public.email_send_log;
create policy "Family members can view their email logs"
  on public.email_send_log for select
  using (public.is_family_member(family_id));

-- Service role handles inserts/upserts (Edge Functions run as service role)
grant select on public.email_send_log to authenticated;
grant all    on public.email_send_log to service_role;

-- ============================================================
-- 3) Schedule nightly-summary-runner via pg_cron
--    Runs every 15 minutes; the function itself handles
--    timezone-aware scheduling and deduplication.
--
--    Replace <YOUR_PROJECT_REF> with your Supabase project ref,
--    e.g. "abcdefghijklmnop" (found in Project Settings → General)
--    Replace <YOUR_SERVICE_ROLE_KEY> with the service_role key
--    (found in Project Settings → API → service_role secret).
--
--    IMPORTANT: after filling in the values below, uncomment
--    and run the cron.schedule() call.
-- ============================================================

-- select cron.schedule(
--   'homequest-nightly-summary-runner',       -- job name (unique)
--   '*/15 * * * *',                           -- every 15 minutes
--   $$
--     select net.http_post(
--       url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/nightly-summary-runner',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
--       ),
--       body    := '{}'::jsonb
--     ) as request_id;
--   $$
-- );

-- To verify the job was created:
--   select jobname, schedule, command from cron.job;

-- To remove the job if needed:
--   select cron.unschedule('homequest-nightly-summary-runner');

commit;
