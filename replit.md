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
- **Migration v3**: `supabase-migration-v3.sql` — adds database-backed catalogs (chore_catalog, reward_catalog), points_ledger, reward_redemptions, recreated daily_status, and RPCs (add_child, toggle_chore, redeem_reward, grant_bonus, seed_default_catalog). Run AFTER v2.

## Auth Flow
1. Parent signs up with email + 6-digit PIN → Supabase Auth creates user
2. Database trigger `handle_new_user()` auto-creates: family + family_members + family_settings (with primary_parent_email auto-filled from signup email)
3. If trigger doesn't fire, frontend fallback calls `ensure_family_exists()` RPC which creates everything atomically
4. Parent adds children via `add_child` RPC (from SelectChild page or Parent Panel)
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

### Catalog (Database-backed)
| Table | Purpose |
|---|---|
| `chore_catalog` | Per-family chore definitions (category, name, points, active, sort_order) |
| `reward_catalog` | Per-family reward definitions (category, name, cost, requires_approval, active, sort_order) |

### Activity & History
| Table | Purpose |
|---|---|
| `points_ledger` | Point audit trail — all point changes (chore, unchore, bonus, purchase). Child points derived from SUM of points_delta. |
| `daily_status` | Per-child per-day chore completion tracking (completed_chore_ids uuid[], composite PK on child_id + date_key) |
| `reward_redemptions` | Reward redemption history (child_id, reward_id, cost, status) |
| `child_badges` | Earned achievement badges |

### Key Design Decisions
- **Catalog is database-backed**: chore_catalog and reward_catalog tables store per-family catalog items. Auto-seeded from CATALOG constants via `seed_default_catalog` RPC when empty.
- **Points are derived**: No separate child_points table. Points computed from `SUM(points_delta)` on points_ledger.
- **All mutations go through RPCs**: toggle_chore, redeem_reward, grant_bonus, add_child — for security and business logic consistency.
- `family_settings` stores email + daily summary preferences only (NOT catalog config)
- `family_members` has `user_id` as primary key (one family per parent)
- All writes to `families`/`family_members` happen via `security definer` RPCs or triggers
- Children use `display_name` field (not `name`)

## Supabase RPCs
- `ensure_family_exists(p_display_name)` - Creates family + family_members + family_settings if missing. Called as fallback on login.
- `current_family_id()` - Helper used by RLS policies. Reads from `family_members`.
- `add_child(p_display_name)` - Creates a child in the caller's family.
- `toggle_chore(p_child_id, p_chore_id, p_date_key)` - Toggles chore completion, writes to daily_status + points_ledger atomically.
- `redeem_reward(p_child_id, p_reward_id)` - Redeems reward, checks balance, writes to reward_redemptions + points_ledger atomically.
- `grant_bonus(p_child_id, p_points, p_reason)` - Awards bonus points, writes to points_ledger.
- `seed_default_catalog(p_family_id)` - Seeds chore_catalog + reward_catalog from STARTER constants if empty. Called automatically by frontend hooks.

## Key Pages
- `/login` - Parent sign in (email + 6-digit PIN)
- `/signup` - Parent account creation (email + 6-digit PIN + name)
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
- `useChoreCatalog()` and `useRewardCatalog()` hooks auto-seed on first load if catalog is empty

## Key Files
- `supabase-setup.sql` - Original database setup (reference)
- `supabase-migration-v2.sql` - Updated RPCs for family_members/family_settings schema
- `supabase-migration-v3.sql` - Database-backed catalogs, points_ledger, RPCs
- `client/src/lib/supabase.ts` - Supabase client configuration
- `client/src/lib/auth-context.tsx` - Auth provider with session management + ensure_family_exists fallback
- `client/src/hooks/use-data.ts` - All data hooks (Supabase queries/mutations via RPCs)
- `client/src/pages/ParentPanel.tsx` - Parent panel with settings, child management, email config
- `shared/catalog.ts` - Master chore/reward catalogs (seeding source)
- `shared/schema.ts` - TypeScript types (EnabledChore, EnabledReward, ChoreCatalogRow, RewardCatalogRow, PointsLedgerRow, etc.)

## Daily Summary Email System
- Frontend computes family-wide summary (all children) using Supabase queries
- Summary data + recipient emails POSTed to Express backend `/api/summary/send`
- Backend formats HTML email and sends via SendGrid to all configured parent emails
- **From email**: Uses `SENDGRID_FROM_EMAIL` env var (currently `homequest@oibrigado.com`), falls back to connector-provided email
- Supports primary + secondary parent email (both stored in family_settings)
- Email shows per-child breakdown: completed/missed chores, bonuses, purchases, points, balance
- "Test Nightly Email Now" button in Parent Panel triggers immediate send for pipeline validation
- Settings in family_settings: daily_summary_enabled, daily_summary_time_local (HH:MM), timezone (IANA)

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
