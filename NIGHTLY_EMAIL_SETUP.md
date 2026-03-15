# Nightly Summary Email Setup

The pg_cron job that triggers nightly summary emails is commented out in
`supabase-migration-v10.sql` because it requires your specific Supabase
project credentials.

## To activate automatic daily emails

1. Open `supabase-migration-v10.sql` and find the commented-out
   `cron.schedule()` block near the bottom.

2. Fill in your values:
   - `<YOUR_PROJECT_REF>` — found in **Supabase Dashboard → Project Settings → General**
     (the short alphanumeric string, e.g. `abcdefghijklmnop`)
   - `<YOUR_SERVICE_ROLE_KEY>` — found in **Project Settings → API → service_role** secret

3. Uncomment the block (remove the `--` prefix from each line).

4. Run the updated block in **Supabase Dashboard → SQL Editor**.

5. Verify the job was created:
   ```sql
   select jobname, schedule, command from cron.job;
   ```

The job runs every 15 minutes. The Edge Function itself handles
timezone-aware scheduling and deduplication, so each family only
receives one email per day at their configured time.

## To remove the job later
```sql
select cron.unschedule('homequest-nightly-summary-runner');
```
