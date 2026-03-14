# Chore Helper — Power Apps Conversion

A full offline-capable Canvas App for Microsoft Power Apps, converted from the
Supabase/React web app. Kids can use it on a tablet or phone with no internet;
changes queue locally and sync when connectivity returns.

---

## Folder Structure

```
powerapp/
├── README.md               ← this file
├── data/
│   └── sharepoint-schema.md   ← SharePoint list setup instructions
├── screens/
│   ├── App.OnStart.txt        ← Global vars, offline load, catalog init
│   ├── LoginScreen.txt        ← Parent email + PIN login
│   ├── KidJoinScreen.txt      ← Kid family-code + PIN join
│   ├── HomeScreen.txt         ← Dashboard: greeting, points, quick nav
│   ├── ChoresScreen.txt       ← Chore list with toggle + status
│   ├── RewardsScreen.txt      ← Reward shop with redeem
│   ├── BadgesScreen.txt       ← Achievements / badge progress
│   ├── ChildSelectScreen.txt  ← Parent picks which child to manage
│   └── ParentPanelScreen.txt  ← Parent controls: approvals, bonus, settings
└── flows/
    ├── DailySummaryEmail.json ← Power Automate scheduled email flow
    └── ApprovalNotify.json    ← Notifies parent when chore needs approval
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Power Apps license | Per-user or per-app plan |
| SharePoint (M365) | For all data lists (no premium connector needed) |
| Power Automate | For email flows (standard connectors) |
| Office 365 Outlook | For sending summary emails |
| Power Apps mobile app | For offline support on iOS / Android |

> **Offline capability only works in the Power Apps mobile app**, not the
> browser. The app degrades gracefully in the browser (online-only).

---

## Quick-Start Setup

### Step 1 — Create SharePoint Lists
Follow `data/sharepoint-schema.md` to create all 9 lists in your SharePoint site.

### Step 2 — Create the Canvas App
1. Go to [make.powerapps.com](https://make.powerapps.com)
2. **Create** → **Canvas app from blank** → **Tablet layout**
3. Name it **Chore Helper**
4. Connect to SharePoint:
   - **Data** panel → **Add data** → **SharePoint**
   - Select your site, add all 9 lists

### Step 3 — Configure App Settings
In Power Apps Studio:
- **Settings** → **General** → Enable **"Can be used offline"**
- **Settings** → **Display** → Set orientation to **Portrait** for phone, **Landscape** for tablet

### Step 4 — Add Screens
Create these screens (rename the default Screen1 to HomeScreen):
- LoginScreen
- KidJoinScreen
- HomeScreen
- ChoresScreen
- RewardsScreen
- BadgesScreen
- ChildSelectScreen
- ParentPanelScreen

### Step 5 — Copy Formulas
For each screen, copy the formulas from the corresponding `.txt` file in
`screens/` into Power Apps Studio:
- **App.OnStart** → paste into the App's `OnStart` property
- Each screen's formulas are labeled with the **control name** and **property**
  (e.g., `btnLogin.OnSelect`)

### Step 6 — Import Power Automate Flows
1. Go to [flow.microsoft.com](https://flow.microsoft.com)
2. **My flows** → **Import** → upload `DailySummaryEmail.json`
3. Reconnect the SharePoint and Outlook connections
4. Enable the flow

### Step 7 — Publish
- **File** → **Save** → **Publish**
- Share the app with family members from the **Share** dialog

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Power Apps Canvas App          │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │  Parent  │  │   Kid    │  ← modes   │
│  │   Mode   │  │   Mode   │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  Local Collections (offline buffer)     │
│  colChores / colRewards / colPending    │
│  ← SaveData/LoadData (device storage)  │
└──────────────┬──────────────────────────┘
               │ sync when online
               ▼
┌─────────────────────────────────────────┐
│         SharePoint Lists (M365)          │
│  Families · Children · ChoreCatalog     │
│  RewardCatalog · DailyStatus            │
│  PointsLedger · RewardRedemptions       │
│  ChildBadges · FamilySettings           │
└─────────────────────────────────────────┘
               │ scheduled trigger
               ▼
┌─────────────────────────────────────────┐
│         Power Automate Flows            │
│  DailySummaryEmail (scheduled nightly)  │
│  ApprovalNotify (instant, on change)    │
└─────────────────────────────────────────┘
```

---

## Mode System

The app has two modes controlled by `gblMode`:

| Mode | How to enter | Access |
|---|---|---|
| `"parent"` | Email login via Azure AD / Office 365 | All features |
| `"kid"` | Family code (6-digit) + child PIN | Own chores + rewards only |

Parent portal within parent mode is additionally PIN-protected
(`gblParentUnlocked = true`).

---

## Offline Strategy

1. On `App.OnStart`, `LoadData()` restores all local collections from device storage
2. If `Connection.Connected`, fresh data is fetched from SharePoint and `SaveData()` re-caches it
3. All writes go to a `colPendingSync` queue AND to the local collection (optimistic update)
4. A 30-second timer checks `Connection.Connected`; if true, it flushes `colPendingSync` to SharePoint via `Patch()`
5. After sync, `colPendingSync` entries are marked `synced = true`

---

## Color Palette

```
Primary:     #6366F1  (indigo)
Success:     #22C55E  (green)
Warning:     #F59E0B  (amber)
Danger:      #EF4444  (red)
Background:  #F8FAFC  (light gray)
Card:        #FFFFFF
Text:        #1E293B
TextMuted:   #64748B
```
