# Chore Helper (HomeQuest)

## Overview
A multi-family gamified chore-tracking app for kids with parent control panels. Parents sign up with email + 6-digit PIN, create child profiles, and configure which catalog chores/rewards are enabled with custom point/cost values. Kids complete chores to earn points and redeem rewards, all scoped to their family.

## Architecture
- **Frontend**: React + Vite + TanStack Query + Wouter (routing) + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Express.js (TypeScript) - serves frontend + email endpoint only
- **Database**: Supabase (PostgreSQL) with RLS policies for multi-family isolation
- **Auth**: Supabase Auth (email + 6-digit PIN as password)
- **Data Access**: Supabase JS client directly from frontend (RLS-protected)
- **Email**: SendGrid integration for daily parent summaries (server-side only)
- **Port**: 5000 (frontend + backend served together via Vite middleware)

## Auth Flow
1. Parent signs up with email + 6-digit PIN → Supabase Auth creates user
2. Database trigger `handle_new_user()` auto-creates: family, parent_profile, family_config
3. Parent adds children from SelectChild page (with optional 4-digit PIN)
4. Child selection stored in localStorage + React context
5. All data queries scoped by family_id and child_id via RLS

## Key Pages
- `/login` - Parent sign in (email + 6-digit PIN)
- `/signup` - Parent account creation
- `/select-child` - Child profile picker (with optional PIN verification)
- `/` - Home dashboard (points display, quick actions, progress bar, parent zone)
- `/chores` - Chore checklist with category filters
- `/rewards` - Reward store with category filters
- `/badges` - Achievement badges + purchase history
- `/parent` - Parent panel (child management, bonus points, catalog config, daily summary, settings)

## Data Model (Supabase tables - see supabase-migration.sql)
- `families` - Family groups, keyed by owner_user_id
- `parent_profiles` - Links Supabase Auth users to families
- `children` - Child profiles per family (name, avatar, optional pin_hash)
- `child_points` - Running point totals per child (points, lifetime_points)
- `family_config` - Per-family catalog settings (enabled items, custom points/costs, allowance settings, parent_email, secondary_parent_email)
- `daily_status` - Per-child per-day chore completion tracking (JSONB completed_chores map)
- `ledger_events` - Point audit trail (chore_completed, chore_unchecked, bonus_award, purchase)
- `purchases` - Reward redemption history
- `child_badges` - Earned achievement badges

## Catalog System (shared/catalog.ts)
- Hardcoded master catalogs: CATALOG.chores, CATALOG.rewards, CATALOG.bonusReasons
- STARTER_CHORES / STARTER_REWARDS define defaults for new families
- family_config stores which items are enabled + custom point/cost overrides
- flattenCatalog(), findCategoryName(), clampNumber(), localDateKey() utility functions

## Key Files
- `supabase-migration.sql` - Full database schema, RLS policies, triggers, RPCs
- `client/src/lib/supabase.ts` - Supabase client configuration
- `client/src/lib/auth-context.tsx` - Auth provider with session management
- `client/src/hooks/use-data.ts` - All data hooks (Supabase queries/mutations)
- `shared/catalog.ts` - Master chore/reward catalogs
- `shared/schema.ts` - TypeScript types (EnabledChore, EnabledReward)

## Supabase RPCs
- `create_child(p_name, p_avatar, p_pin)` - Creates child + child_points row
- `verify_child_pin(p_child_id, p_pin)` - PIN verification for child login
- `increment_child_points(p_child_id, p_delta, p_add_lifetime)` - Atomic point updates

## Daily Summary Email System
- Frontend computes family-wide summary (all children) using Supabase queries
- Summary data + recipient emails POSTed to Express backend `/api/summary/send`
- Backend formats HTML email and sends via SendGrid to all configured parent emails
- Supports primary + secondary parent email (both stored in family_config)
- Email shows per-child breakdown: completed/missed chores, bonuses, purchases, points, balance
- "Test Nightly Email Now" button in Parent Panel triggers immediate send for pipeline validation
- Scheduling fields in family_config: daily_summary_enabled, daily_summary_time_local (HH:MM), daily_summary_timezone (IANA)
- Schema changes required (run in Supabase SQL Editor):
  - `ALTER TABLE family_config ADD COLUMN IF NOT EXISTS secondary_parent_email text;`
  - `ALTER TABLE family_config ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean DEFAULT false;`
  - `ALTER TABLE family_config ADD COLUMN IF NOT EXISTS daily_summary_time_local text DEFAULT '18:00';`
  - `ALTER TABLE family_config ADD COLUMN IF NOT EXISTS daily_summary_timezone text DEFAULT 'America/Denver';`

## User Preferences
- Kid-friendly, gamified UI with fun fonts and bright colors
- Confetti animation on chore completion
- Bottom navigation bar (5 tabs)
- Mobile-first responsive design
