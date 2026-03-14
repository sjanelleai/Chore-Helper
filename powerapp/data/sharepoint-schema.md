# SharePoint Lists — Chore Helper Schema

Create these 9 lists in your SharePoint site. All lists use the default `ID`
(auto-number) and `Title` columns unless noted. Add the extra columns listed
under each list.

Go to: **SharePoint Site** → **New** → **List** for each one.

---

## 1. Families

**Internal name:** `Families`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Family display name |
| OwnerEmail | Single line of text | Yes | Primary parent email (matches O365 login) |
| FamilyCode | Single line of text | Yes | 6-digit code kids use to join |
| CreatedDate | Date and Time | No | Auto-set on creation |

> After creating each family, generate a random 6-digit `FamilyCode` and store it.

---

## 2. FamilySettings

**Internal name:** `FamilySettings`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Set to FamilyID for easy lookup |
| FamilyID | Number | Yes | ID from Families list |
| PrimaryEmail | Single line of text | No | Daily summary recipient |
| SecondaryEmail | Single line of text | No | Optional CC |
| DailySummaryEnabled | Yes/No | No | Default: No |
| SummaryTime | Single line of text | No | "HH:MM" format (24h) |
| Timezone | Single line of text | No | e.g. America/Denver |
| ApprovalMode | Choice | No | Choices: never, always, smart |
| ApprovalThreshold | Number | No | Points above which approval required |
| ParentPortalPIN | Single line of text | No | Store as plain text or hash |

---

## 3. Children

**Internal name:** `Children`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Child display name |
| FamilyID | Number | Yes | FK → Families.ID |
| ChildPIN | Single line of text | No | 4-digit PIN for kid login |
| AvatarURL | Single line of text | No | URL to avatar image |
| IsActive | Yes/No | No | Default: Yes |

---

## 4. ChoreCatalog

**Internal name:** `ChoreCatalog`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Chore name (e.g. "Make bed") |
| FamilyID | Number | Yes | FK → Families.ID |
| Category | Choice | Yes | Room, Kitchen, Pets, School, Family |
| Points | Number | Yes | Points awarded on completion |
| IsActive | Yes/No | Yes | Default: Yes |
| SortOrder | Number | No | Display order within category |
| ApprovalOverride | Choice | No | Choices: inherit, always, never |

---

## 5. RewardCatalog

**Internal name:** `RewardCatalog`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Reward name (e.g. "+15min screen time") |
| FamilyID | Number | Yes | FK → Families.ID |
| Category | Choice | Yes | Privileges, Experiences, Food Treats, Toys/Items, Allowance |
| Cost | Number | Yes | Points required |
| RequiresApproval | Yes/No | No | Default: No |
| IsActive | Yes/No | Yes | Default: Yes |
| SortOrder | Number | No | Display order |

---

## 6. DailyStatus

**Internal name:** `DailyStatus`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Auto-set to "ChildID_ChoreID_Date" |
| ChildID | Number | Yes | FK → Children.ID |
| ChoreID | Number | Yes | FK → ChoreCatalog.ID |
| DateKey | Date and Time | Yes | Date only (no time) |
| IsCompleted | Yes/No | No | Default: No |
| Status | Choice | Yes | Choices: unchecked, pending, approved |
| VerifiedBy | Single line of text | No | Parent email who approved |
| VerifiedAt | Date and Time | No | When approved |

> **Note:** To avoid duplicates, query by ChildID + ChoreID + DateKey before inserting.

---

## 7. PointsLedger

**Internal name:** `PointsLedger`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Auto-set to event description |
| FamilyID | Number | Yes | FK → Families.ID |
| ChildID | Number | Yes | FK → Children.ID |
| DateKey | Date and Time | Yes | Date of transaction |
| EventType | Choice | Yes | chore_complete, chore_uncheck, bonus, purchase, manual_adjust, deduction |
| RefID | Number | No | FK to chore or reward |
| PointsDelta | Number | Yes | Positive or negative |
| Note | Multiple lines of text | No | Reason / description |

---

## 8. RewardRedemptions

**Internal name:** `RewardRedemptions`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Auto-set to "ChildName redeemed RewardName" |
| FamilyID | Number | Yes | FK → Families.ID |
| ChildID | Number | Yes | FK → Children.ID |
| RewardID | Number | Yes | FK → RewardCatalog.ID |
| Cost | Number | Yes | Points spent at time of redemption |
| Status | Choice | Yes | Choices: requested, approved, denied, fulfilled |
| RedeemedDate | Date and Time | No | Auto-set to now() |

---

## 9. ChildBadges

**Internal name:** `ChildBadges`

| Column Name | Type | Required | Notes |
|---|---|---|---|
| Title | Single line of text | Yes | Badge name (e.g. "Chore Master") |
| ChildID | Number | Yes | FK → Children.ID |
| BadgeKey | Single line of text | Yes | starter, helper2, master, star, champion, legend |
| BadgeIcon | Single line of text | No | Emoji or icon name |
| Threshold | Number | Yes | Lifetime points required |
| EarnedDate | Date and Time | No | When badge was unlocked |

---

## Default Chore Catalog (seed data)

After creating the ChoreCatalog list, add these rows for your family
(replace `FamilyID` with your actual family record ID):

| Category | Title | Points |
|---|---|---|
| Room | Make bed | 15 |
| Room | Put clothes in hamper | 15 |
| Room | Pick up floor | 20 |
| Room | Tidy desk | 20 |
| Room | Clean room (quick) | 35 |
| Room | Clean room (deep) | 120 |
| Kitchen | Clear plate | 15 |
| Kitchen | Load dishwasher | 30 |
| Kitchen | Unload dishwasher | 40 |
| Kitchen | Wipe counters | 35 |
| Kitchen | Set table | 20 |
| Pets | Feed pet | 20 |
| Pets | Water bowl | 15 |
| Pets | Pet cleanup | 40 |
| School | Homework 15 min | 25 |
| School | Homework 30 min | 50 |
| School | Reading 15 min | 25 |
| School | Pack backpack | 20 |
| Family | Help a sibling | 25 |
| Family | Take out trash | 25 |
| Family | Laundry helper | 40 |

---

## Default Reward Catalog (seed data)

| Category | Title | Cost |
|---|---|---|
| Privileges | Pick music in car | 700 |
| Privileges | Pick the game | 650 |
| Privileges | +15 min screen time | 1200 |
| Privileges | +30 min screen time | 2000 |
| Privileges | +15 min bedtime | 1400 |
| Privileges | +30 min bedtime | 2400 |
| Experiences | Ice cream trip | 2200 |
| Experiences | Movie night | 2600 |
| Experiences | Arcade | 3500 |
| Experiences | Bowling | 4200 |
| Food Treats | Dessert tonight | 1200 |
| Food Treats | Smoothie | 1500 |
| Food Treats | Pick dinner | 3200 |
| Toys/Items | Small trinket | 3000 |
| Toys/Items | Book of choice | 4200 |
| Allowance | $1 cash | 0 |
| Allowance | $5 cash | 0 |
| Allowance | $10 cash | 0 |

---

## Badge Thresholds (reference)

| Badge Key | Badge Name | Icon | Lifetime Points |
|---|---|---|---|
| starter | Starter | ⭐ | 50 |
| helper2 | Helper Level 2 | 🌟 | 150 |
| master | Chore Master | 🏆 | 300 |
| star | Super Star | 💫 | 500 |
| champion | Champion | 🥇 | 1000 |
| legend | Legend | 👑 | 2000 |
