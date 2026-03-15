# Nightly Summary Email — Full Setup Checklist

Follow every step in order. Each section must be completed before the next.

---

## Step 1 — Enable Supabase Extensions

In **Supabase Dashboard → Database → Extensions**, enable both:

| Extension | Purpose |
|-----------|---------|
| `pg_cron` | Runs the scheduler every 15 min |
| `pg_net`  | Lets the scheduler make HTTP calls |

> If either extension is missing from the list your plan may not support it.
> Both are available on the **Free** tier.

---

## Step 2 — Set SendGrid Secrets

In **Supabase Dashboard → Edge Functions → Secrets** (or via CLI):

```bash
supabase secrets set SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
supabase secrets set SENDGRID_FROM_EMAIL=apps@oibrigado.com
supabase secrets set SENDGRID_FROM_NAME="HomeQuest"
```

`SENDGRID_FROM_EMAIL` must be a verified sender in your SendGrid account.

---

## Step 3 — Deploy Both Edge Functions

From your project root (requires [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase functions deploy nightly-summary-runner
supabase functions deploy send-family-summary
```

Confirm both appear in **Supabase Dashboard → Edge Functions**.

---

## Step 4 — Run the Database Migration (v10)

In **Supabase Dashboard → SQL Editor**, run `supabase-migration-v10.sql`
*(the base migration without the cron block — just the schema additions).*

This creates the `email_send_log` table and adds the required columns to
`family_settings` if they don't already exist.

---

## Step 5 — Activate the Cron Job

You need two values from **Supabase Dashboard → Project Settings**:

| Value | Where to find it |
|-------|-----------------|
| `PROJECT_REF` | **General** tab → "Reference ID" (e.g. `abcdefghijklmnop`) |
| `SERVICE_ROLE_KEY` | **API** tab → "service_role" secret |

Paste the following into **SQL Editor** after filling in your values:

```sql
select cron.schedule(
  'homequest-nightly-summary-runner',
  '*/15 * * * *',
  $$
    select net.http_post(
      url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/nightly-summary-runner',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body    := '{}'::jsonb
    ) as request_id;
  $$
);
```

---

## Step 6 — Verify the Job Was Created

```sql
select jobname, schedule, active from cron.job;
```

You should see `homequest-nightly-summary-runner` with schedule `*/15 * * * *`.

---

## Step 7 — Test Manually (Optional but Recommended)

Trigger the runner immediately to confirm the full pipeline works:

```bash
curl -X POST \
  https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/nightly-summary-runner \
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Check the response — `sent` > 0 means an email was dispatched.
Check `email_send_log` to confirm:

```sql
select * from email_send_log order by created_at desc limit 10;
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `cron.schedule` function not found | `pg_cron` extension not enabled |
| `net.http_post` function not found | `pg_net` extension not enabled |
| Edge function returns 500 | Check function logs in Dashboard → Edge Functions → Logs |
| Emails not arriving | Verify SENDGRID_API_KEY secret is set and sender is verified |
| `sent: 0` despite correct time | Family's `daily_summary_enabled` may be false, or time hasn't been saved |
| Duplicate prevention | Each family only gets one email per `date_key`; check `email_send_log` |

---

## Removing the Job

```sql
select cron.unschedule('homequest-nightly-summary-runner');
```
