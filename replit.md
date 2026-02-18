# Chore Helper

## Overview
A gamified chore-tracking app for kids with a parent control panel. Kids complete chores to earn points which they can spend on approved rewards. Parents can award bonus points, approve/reject rewards, configure allowance mode, and receive daily email summaries.

## Architecture
- **Frontend**: React + Vite + TanStack Query + Wouter (routing) + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL via Drizzle ORM
- **Email**: SendGrid integration for daily parent summaries
- **Port**: 5000 (frontend + backend served together via Vite middleware)

## Key Pages
- `/` - Home dashboard (points display, quick actions, progress bar, parent zone shortcuts)
- `/chores` - Chore checklist with section filters (morning/afternoon/bedtime)
- `/rewards` - Reward store with category filters (only approved rewards shown)
- `/badges` - Achievement badges + purchase history
- `/parent` - Parent panel (bonus points, reward approvals, daily summary, settings)

## Data Model (shared/schema.ts)
- `chores` - Task list with points, icons, sections, completion status
- `rewards` - Reward catalog with categories, costs, approval status, allowance flag
- `badges` - Achievement badges with point thresholds
- `purchases` - Purchase history
- `userState` - Single-row config (points, email, timezone, allowance settings)
- `ledgerEvents` - Point audit trail (CHORE_COMPLETE, CHORE_UNCHECK, BONUS_AWARD, REWARD_REDEEM)
- `dailySummaries` - Email delivery tracking

## API Routes (shared/routes.ts)
- Chores: GET /api/chores, POST /api/chores/:id/toggle, POST /api/chores/reset
- Rewards: GET /api/rewards, POST /api/rewards/:id/buy, POST /api/rewards/:id/approve
- Badges: GET /api/badges
- User: GET /api/user/state, PUT /api/user/settings, GET /api/user/purchases
- Bonus: POST /api/bonus
- Ledger: GET /api/ledger
- Summary: GET /api/summary/daily, POST /api/summary/send

## Recent Changes (Feb 2026)
- Added parent panel with bonus points, reward approvals, daily summary, settings
- Added ledger events for point audit trail
- Added reward categories and approval workflow
- Added allowance mode (points-to-dollars conversion)
- Added SendGrid email integration for daily summaries
- Expanded reward catalog across 9 categories
- Added category filtering on Rewards page

## User Preferences
- Kid-friendly, gamified UI with fun fonts and bright colors
- Confetti animation on chore completion
- Bottom navigation bar (5 tabs)
