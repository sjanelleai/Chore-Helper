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

## Supabase Setup
- **Definitive setup script**: `supabase-setup.sql` — run this ONCE in Supabase SQL Editor to create all tables, RLS policies, triggers, RPCs, and backfills. Safe to re-run (idempotent).
- **Legacy file**: `supabase-migration.sql` — same content, kept for reference.

## Auth Flow
1. Parent signs up with email + 6-digit PIN → Supabase Auth creates user
2. Database trigger `handle_new_user()` auto-creates: family + parent_profile + family_config (with parent_email auto-filled from signup email)
3. If trigger doesn't fire, frontend fallback calls `ensure_family_exists()` RPC which creates everything atomically
4. Parent adds children from SelectChild page (with optional 4-digit PIN)
5. Child selection stored in localStorage + React context
6. All data queries scoped by family_id via RLS using `current_family_id()` helper

## Database Schema (Supabase tables)

### Identity & Membership
| App table | Recommended equivalent | Purpose |
|---|---|---|
| `families` | `families` | One row per household, keyed by `owner_user_id` |
| `parent_profiles` | `family_members` | Links Supabase Auth users to families (supports future multi-parent) |
| `children` | `children` | Child profiles per family (name, avatar, optional pin_hash) |

### Settings & Configuration
| App table | Recommended equivalent | Purpose |
|---|---|---|
| `family_config` | `family_settings` | Per-family settings: parent emails, daily summary schedule, catalog config (enabled chores/rewards, custom points/costs, allowance) |

### Activity & History
- `child_points` - Running point totals per child (points, lifetime_points)
- `daily_status` - Per-child per-day chore completion tracking (JSONB completed_chores map)
- `ledger_events` - Point audit trail (chore_completed, chore_unchecked, bonus_award, purchase)
- `purchases` - Reward redemption history
- `child_badges` - Earned achievement badges

### Key Design Decisions
- `family_config` is a **structured table** with typed columns for settings (parent_email, daily_summary_enabled, etc.) AND JSONB columns for catalog configuration (enabled_chores, enabled_rewards, points_by_chore_id, cost_by_reward_id). It is NOT a generic key/value store — each setting has its own column.
- `parent_profiles` has `user_id` as primary key (one family per parent). To support multiple parents per family in the future, additional rows can be added.
- All writes to `families`/`parent_profiles` happen via `security definer` RPCs or triggers, not direct client inserts (these tables are not exposed via PostgREST API).
- **Schema naming divergence**: The app uses `parent_profiles` (not `family_members`), `family_config` (not `family_settings`), and `owner_user_id` (not `created_by`). These are functionally equivalent to the recommended architecture — only the names differ. Renaming would require rewriting all frontend queries with no functional benefit.

## Supabase RPCs
- `ensure_family_exists(p_display_name)` - **Critical**: Creates family + parent_profile + family_config if missing. Called as fallback on login. Returns `{ family_id, display_name }`.
- `current_family_id()` - Helper used by RLS policies to scope queries to the current user's family.
- `create_child(p_name, p_avatar, p_pin)` - Creates child + child_points row with optional PIN hash.
- `verify_child_pin(p_child_id, p_pin)` - PIN verification for child login.
- `increment_child_points(p_child_id, p_delta, p_add_lifetime)` - Atomic point updates.

## Key Pages
- `/login` - Parent sign in (email + 6-digit PIN)
- `/signup` - Parent account creation (email + 6-digit PIN + name)
- `/select-child` - Child profile picker (with optional PIN verification)
- `/` - Home dashboard (points display, quick actions, progress bar, parent zone)
- `/chores` - Chore checklist with category filters
- `/rewards` - Reward store with category filters
- `/badges` - Achievement badges + purchase history
- `/parent` - Parent panel (child management, bonus points, catalog config, daily summary, settings)

## Catalog System (shared/catalog.ts)
- Hardcoded master catalogs: CATALOG.chores, CATALOG.rewards, CATALOG.bonusReasons
- STARTER_CHORES / STARTER_REWARDS define defaults for new families
- family_config stores which items are enabled + custom point/cost overrides
- flattenCatalog(), findCategoryName(), clampNumber(), localDateKey() utility functions

## Key Files
- `supabase-setup.sql` - **Definitive** database setup: tables, RLS, triggers, RPCs (run once in Supabase SQL Editor)
- `client/src/lib/supabase.ts` - Supabase client configuration
- `client/src/lib/auth-context.tsx` - Auth provider with session management + ensure_family_exists fallback
- `client/src/hooks/use-data.ts` - All data hooks (Supabase queries/mutations)
- `client/src/pages/ParentPanel.tsx` - Parent panel with settings, child management, email config
- `shared/catalog.ts` - Master chore/reward catalogs
- `shared/schema.ts` - TypeScript types (EnabledChore, EnabledReward)

## Daily Summary Email System
- Frontend computes family-wide summary (all children) using Supabase queries
- Summary data + recipient emails POSTed to Express backend `/api/summary/send`
- Backend formats HTML email and sends via SendGrid to all configured parent emails
- Supports primary + secondary parent email (both stored in family_config)
- Email shows per-child breakdown: completed/missed chores, bonuses, purchases, points, balance
- "Test Nightly Email Now" button in Parent Panel triggers immediate send for pipeline validation
- Settings in family_config: daily_summary_enabled, daily_summary_time_local (HH:MM), daily_summary_timezone (IANA)

## Parent Settings Behavior
- Primary parent email: auto-filled from signup email (server-side via trigger/RPC), editable in settings
- Secondary parent email: optional, also receives daily summaries
- Duplicate email validation: UI prevents primary == secondary (case-insensitive, trimmed)
- Save button disabled when emails match

## User Preferences
- Kid-friendly, gamified UI with fun fonts and bright colors
- Confetti animation on chore completion
- Bottom navigation bar (5 tabs)
- Mobile-first responsive design
