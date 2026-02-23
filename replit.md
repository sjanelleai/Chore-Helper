# Chore Helper (HomeQuest)

## Overview
A multi-family gamified chore-tracking app for kids with parent control panels. Parents sign up with email + password (min 8 chars), create child profiles, and configure which catalog chores/rewards are enabled with custom point/cost values. Kids complete chores to earn points and redeem rewards, all scoped to their family.

## Architecture
- **Frontend**: React + Vite + TanStack Query + Wouter (routing) + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Express.js (TypeScript) - serves frontend + email endpoint only
- **Database**: Supabase (PostgreSQL) with RLS policies for multi-family isolation
- **Auth**: Supabase Auth (email + password, min 8 chars)
- **Data Access**: Supabase JS client directly from frontend (RLS-protected)
- **Email**: SendGrid integration for daily parent summaries (server-side only)
- **Port**: 5000 (frontend + backend served together via Vite middleware)

## Supabase Setup
- **Original setup script**: `supabase-setup.sql` — original schema with old table names (parent_profiles, family_config). Reference only.
- **Migration v2**: `supabase-migration-v2.sql` — updates RPCs and RLS for the current schema (family_members, family_settings, children.display_name). Run this AFTER the original setup.
- **Migration v3**: `supabase-migration-v3.sql` — adds database-backed catalogs (chore_catalog, reward_catalog), points_ledger, reward_redemptions, daily_status (legacy array-based), and RPCs. Run AFTER v2.
- **Migration v4**: `supabase-migration-v4.sql` — adds email_send_log table, remove_child RPC, performance indexes. Run AFTER v3.
- **Migration v5**: `supabase-migration-v5.sql` — **CRITICAL alignment fix**: creates daily_status_v2 (per-chore-row model), adds title column to catalog tables, rewrites toggle_chore RPC with points_ledger writes. Run AFTER v4.
- **Migration v6**: `supabase-migration-v6.sql` — Canonical points functions (`points_earned_for_day`, `family_daily_summary`), catalog versioning (`family_settings.catalog_version`), versioned `seed_default_catalog` RPC. Run AFTER v5.

## Auth Flow
1. Parent signs up with email + password (min 8 chars) → Supabase Auth creates user
2. Database trigger `handle_new_user()` auto-creates: family + family_members + family_settings (with primary_parent_email auto-filled from signup email)
3. If trigger doesn't fire, frontend fallback calls `ensure_family_exists()` RPC which creates everything atomically
4. `ensureCatalogSeeded()` runs immediately after familyId is resolved (auto-populates chore/reward catalogs)
5. Parent adds children via `add_child` RPC (from SelectChild page or Parent Panel)
6. Child selection stored in localStorage + React context
7. All data queries scoped by family_id via RLS using `current_family_id()` helper

## Auth Email Routes (public, no auth required)
- `/auth/callback` — Catch-all for signup confirmation links. Parses hash fragments, establishes session, routes via onboarding gate
- `/reset-password` — Handles Supabase recovery links. Parses hash errors (otp_expired), shows password form or resend UI
- `/accept-invite` — Handles Supabase invite links. Parses hash errors, routes via onboarding gate
- Shared `parseHashParams()` helper in `client/src/lib/auth-helpers.ts` used by all three pages
- Onboarding gate (`checkOnboardingReady` + `routeAfterAuth`) checks family membership + children existence

## Supabase URL Configuration
- Site URL: `https://chore-helper.oibrigado.com`
- Redirect URLs: `/auth/callback`, `/reset-password`, `/accept-invite`
- Email templates must point to the canonical domain routes above

## Database Schema (Supabase tables)

### Identity & Membership
| Table | Purpose |
|---|---|
| `families` | One row per household, keyed by `owner_user_id` |
| `family_members` | Links Supabase Auth users to families (user_id, family_id, role) |
| `children` | Child profiles per family (display_name, avatar, optional pin_hash) |

### Settings & Configuration
| Table | Purpose |
|---|---|
| `family_settings` | Per-family settings: primary_parent_email, secondary_parent_email, daily_summary_enabled, daily_summary_time_local, timezone |

### Catalog (Database-backed)
| Table | Purpose |
|---|---|
| `chore_catalog` | Per-family chore definitions (category, name, title, points, active, sort_order). Frontend uses `title` column. |
| `reward_catalog` | Per-family reward definitions (category, name, title, cost, requires_approval, active, sort_order). Frontend uses `title` column. |

### Activity & History
| Table | Purpose |
|---|---|
| `points_ledger` | Point audit trail — all point changes (chore, unchore, bonus, purchase). Child points derived from SUM of points_delta. |
| `daily_status_v2` | Per-chore per-day completion tracking (child_id, chore_id, date_key, completed). PK on (child_id, chore_id, date_key). |
| `daily_status` | **LEGACY** — old array-based model (completed_chore_ids uuid[]). Kept for reference, NOT used by frontend. |
| `reward_redemptions` | Reward redemption history (child_id, reward_id, cost, status) |
| `child_badges` | Earned achievement badges |

### Key Design Decisions
- **Catalog is database-backed**: chore_catalog and reward_catalog tables store per-family catalog items. Auto-seeded via `ensureCatalogSeeded()` in auth bootstrap (right after familyId is resolved). The `seed_default_catalog` RPC is idempotent — safe to call multiple times.
- **Points are derived**: No separate child_points table. Points computed from `SUM(points_delta)` on points_ledger. **Canonical daily points** use `points_earned_for_day()` (timezone-safe) and `family_daily_summary()` — both UI and email use the same RPC.
- **All mutations go through RPCs**: toggle_chore, redeem_reward, grant_bonus, add_child — for security and business logic consistency.
- `family_settings` stores email + daily summary preferences only (NOT catalog config)
- `family_members` has `user_id` as primary key (one family per parent)
- All writes to `families`/`family_members` happen via `security definer` RPCs or triggers
- Children use `display_name` field (not `name`)

## Supabase RPCs
- `ensure_family_exists(p_display_name)` - Creates family + family_members + family_settings if missing. Called as fallback on login.
- `current_family_id()` - Helper used by RLS policies. Reads from `family_members`.
- `add_child(p_display_name)` - Creates a child in the caller's family.
- `toggle_chore(p_child_id, p_chore_id, p_date_key)` - Toggles chore completion via daily_status_v2 (insert row = completed, delete row = uncompleted) + writes to points_ledger atomically.
- `redeem_reward(p_child_id, p_reward_id)` - Redeems reward, checks balance, writes to reward_redemptions + points_ledger atomically.
- `grant_bonus(p_child_id, p_points, p_reason)` - Awards bonus points, writes to points_ledger.
- `seed_default_catalog(p_family_id)` - Seeds chore_catalog + reward_catalog from STARTER constants if empty. Idempotent. Called automatically by `ensureCatalogSeeded()` during auth bootstrap.
- `points_earned_for_day(p_child_id, p_date_key, p_timezone)` - Canonical timezone-safe daily points from ledger. Used by family_daily_summary.
- `family_daily_summary(p_family_id, p_date_key)` - Canonical daily summary: points_today, completed/missed chores, bonuses, redemptions, balance. Single source of truth for UI + email.
- `remove_child(p_child_id)` - Deletes a child and all associated data (daily_status_v2, daily_status, points_ledger, reward_redemptions, child_badges). Only callable by family members.

## Key Pages
- `/login` - Parent sign in (email + password). Shows `?reset=success` toast after password reset
- `/signup` - Parent account creation (email + password + name)
- `/auth/callback` - Signup confirmation + generic auth redirect landing
- `/reset-password` - Password reset (replaces old /auth/reset). Handles recovery hash, expired links, resend form
- `/accept-invite` - Invite acceptance. Handles invite hash, expired invites, onboarding gate routing
- `/select-child` - Child profile picker (with optional PIN verification)
- `/` - Home dashboard (points display, quick actions, progress bar, parent zone)
- `/chores` - Chore checklist with category filters
- `/rewards` - Reward store with category filters
- `/badges` - Achievement badges + purchase history
- `/parent` - Parent panel (child management, bonus points, catalog config, daily summary, settings)

## Catalog System
- **Master catalogs** in `shared/catalog.ts`: CATALOG.chores, CATALOG.rewards, CATALOG.bonusReasons
- STARTER_CHORES / STARTER_REWARDS define defaults for new families (seeded to DB via `seed_default_catalog` RPC)
- **Runtime catalogs** served from `chore_catalog` and `reward_catalog` DB tables
- Parents can toggle items on/off and set custom points/costs via Parent Panel (writes directly to catalog tables)
- `useChoreCatalog()` and `useRewardCatalog()` hooks are pure readers (no seeding logic)
- Seeding handled centrally by `ensureCatalogSeeded()` in auth bootstrap
- **Catalog versioning**: `family_settings.catalog_version` tracks which version each family has. `seed_default_catalog` RPC is versioned — when `catalog_version < LATEST_VERSION`, upserts missing items and bumps version. `ensureCatalogSeeded()` checks version first, not row count.
- To add new catalog items: bump `v_latest_version` in the RPC, add new inserts in a `if v_current_version < N` block, update `LATEST_CATALOG_VERSION` in `catalogSeed.ts`

## Key Files
- `supabase-setup.sql` - Original database setup (reference)
- `supabase-migration-v2.sql` - Updated RPCs for family_members/family_settings schema
- `supabase-migration-v3.sql` - Database-backed catalogs, points_ledger, RPCs
- `supabase-migration-v4.sql` - email_send_log table, remove_child RPC, recommended indexes
- `supabase-migration-v5.sql` - CRITICAL: daily_status_v2 (per-chore-row), catalog title columns, rewritten toggle_chore RPC
- `supabase-migration-v6.sql` - Canonical points functions, catalog versioning, versioned seed_default_catalog
- `client/src/lib/supabase.ts` - Supabase client configuration
- `client/src/lib/auth-helpers.ts` - Shared auth helpers: parseHashParams(), checkOnboardingReady(), routeAfterAuth()
- `client/src/lib/catalogSeed.ts` - Centralized catalog seeding (ensureCatalogSeeded) called during auth bootstrap
- `client/src/lib/auth-context.tsx` - Auth provider with session management + ensure_family_exists fallback + catalog seeding
- `client/src/hooks/use-data.ts` - All data hooks (Supabase queries/mutations via RPCs)
- `client/src/pages/ParentPanel.tsx` - Parent panel with settings, child management, email config
- `shared/catalog.ts` - Master chore/reward catalogs (seeding source)
- `shared/schema.ts` - TypeScript types (EnabledChore, EnabledReward, ChoreCatalogRow, RewardCatalogRow, PointsLedgerRow, etc.)

## Daily Summary Email System

### Architecture (Option 2: Supabase Cron + Edge Functions + SendGrid)
- **Scheduled delivery**: Supabase Cron runs `nightly-summary-runner` Edge Function every 15 minutes
- **Runner logic**: Finds families due (based on daily_summary_time_local + timezone), dedupes via `email_send_log` table, triggers `send-family-summary` for each due family
- **Sender logic**: Queries Supabase for children/chores/points/redemptions, sends via SendGrid Dynamic Template, logs result to `email_send_log`
- **No Replit backend needed** for scheduled sends — all handled by Supabase Edge Functions

### Edge Functions (deploy to Supabase)
- `supabase/functions/nightly-summary-runner/index.ts` — Cron target, finds due families
- `supabase/functions/send-family-summary/index.ts` — Builds summary, sends via SendGrid API

### Supabase Secrets Required
- `SENDGRID_API_KEY`, `SENDGRID_TEMPLATE_DAILY_SUMMARY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`

### Manual Test Path (still available)
- "Test Nightly Email Now" button in Parent Panel still calls Replit backend `POST /api/summary/send`
- **From email**: Uses `SENDGRID_FROM_EMAIL` env var (currently `homequest@oibrigado.com`), falls back to connector-provided email

### Database
- `email_send_log` table: family_id, date_key, status (sent/failed), error, created_at — unique on (family_id, date_key)
- Migration: `supabase-migration-v4.sql`

### Settings (family_settings)
- daily_summary_enabled, daily_summary_time_local (HH:MM), timezone (IANA)
- primary_parent_email, secondary_parent_email

## Parent Settings Behavior
- Primary parent email: auto-filled from signup email (server-side via trigger/RPC), editable in settings
- Secondary parent email: optional, also receives daily summaries
- Duplicate email validation: UI prevents primary == secondary (case-insensitive, trimmed)
- Save button disabled when emails match

## Navigation Layout
- **Responsive persistent navigation** via AppLayout wrapper in App.tsx
- **Mobile** (< 768px): Fixed bottom navigation bar with 5 tabs (Home, Chores, Store, Badges, Parent)
- **Desktop** (>= 768px): Shadcn Sidebar (collapsible="none") on the left side with same 5 nav items
- Navigation wraps only authenticated pages (not Login, Signup, SelectChild, AuthCallback, AuthReset)
- Pages use `max-w-md md:max-w-2xl` for responsive content width
- `client/src/components/Navigation.tsx` exports AppLayout (layout wrapper) and Navigation (legacy compat)

## User Preferences
- Kid-friendly, gamified UI with fun fonts and bright colors
- Confetti animation on chore completion
- Mobile-first responsive design
