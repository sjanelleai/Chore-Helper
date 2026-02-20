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
- **Original setup script**: `supabase-setup.sql` — original schema with old table names (parent_profiles, family_config). Reference only.
- **Migration v2**: `supabase-migration-v2.sql` — updates RPCs and RLS for the current schema (family_members, family_settings, children.display_name). Run this AFTER the original setup.

## Auth Flow
1. Parent signs up with email + 6-digit PIN → Supabase Auth creates user
2. Database trigger `handle_new_user()` auto-creates: family + family_members + family_settings (with primary_parent_email auto-filled from signup email)
3. If trigger doesn't fire, frontend fallback calls `ensure_family_exists()` RPC which creates everything atomically
4. Parent adds children from SelectChild page (with optional 4-digit PIN)
5. Child selection stored in localStorage + React context
6. All data queries scoped by family_id via RLS using `current_family_id()` helper

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

### Activity & History
- `child_points` - Running point totals per child (points, lifetime_points)
- `daily_status` - Per-child per-day chore completion tracking (JSONB completed_chores map)
- `ledger_events` - Point audit trail (chore_completed, chore_unchecked, bonus_award, purchase)
- `purchases` - Reward redemption history
- `child_badges` - Earned achievement badges

### Key Design Decisions
- **Catalog config** (chores/rewards enabled/points/costs) is currently frontend-only constants (Phase 2 will persist to DB)
- `family_settings` stores email + daily summary preferences only (NOT catalog config)
- `family_members` has `user_id` as primary key (one family per parent)
- All writes to `families`/`family_members` happen via `security definer` RPCs or triggers
- Children use `display_name` field (not `name`)

## Supabase RPCs
- `ensure_family_exists(p_display_name)` - **Critical**: Creates family + family_members + family_settings if missing. Called as fallback on login. Returns `{ family_id, display_name }`.
- `current_family_id()` - Helper used by RLS policies. Reads from `family_members`.
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
- Currently frontend-only (Phase 2: persist to database)
- flattenCatalog(), findCategoryName(), clampNumber(), localDateKey() utility functions

## Key Files
- `supabase-setup.sql` - Original database setup (reference)
- `supabase-migration-v2.sql` - Updated RPCs for family_members/family_settings schema
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
- Supports primary + secondary parent email (both stored in family_settings)
- Email shows per-child breakdown: completed/missed chores, bonuses, purchases, points, balance
- "Test Nightly Email Now" button in Parent Panel triggers immediate send for pipeline validation
- Settings in family_settings: daily_summary_enabled, daily_summary_time_local (HH:MM), timezone (IANA)

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
