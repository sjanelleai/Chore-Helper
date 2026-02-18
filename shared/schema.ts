
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chores = pgTable("chores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  points: integer("points").notNull(),
  icon: text("icon"),
  section: text("section").default("general"),
  completed: boolean("completed").default(false).notNull(),
});

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  threshold: integer("threshold").notNull(),
  icon: text("icon").notNull(),
  earned: boolean("earned").default(false).notNull(),
});

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cost: integer("cost").notNull(),
  icon: text("icon"),
  category: text("category").default("general").notNull(),
  active: boolean("active").default(true).notNull(),
  approved: boolean("approved").default(false).notNull(),
  isAllowance: boolean("is_allowance").default(false).notNull(),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id").notNull(),
  rewardName: text("reward_name").notNull(),
  cost: integer("cost").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

export const userState = pgTable("user_state", {
  id: serial("id").primaryKey(),
  totalPoints: integer("total_points").default(0).notNull(),
  totalEarnedLifetime: integer("total_earned_lifetime").default(0).notNull(),
  parentEmail: text("parent_email"),
  timezone: text("timezone").default("America/Denver"),
  dailySummaryTime: text("daily_summary_time").default("19:30"),
  allowanceEnabled: boolean("allowance_enabled").default(false).notNull(),
  pointsPerDollar: integer("points_per_dollar").default(300).notNull(),
});

export const ledgerEvents = pgTable("ledger_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // CHORE_COMPLETE, CHORE_UNCHECK, BONUS_AWARD, REWARD_REDEEM
  refId: text("ref_id").notNull(),
  pointsDelta: integer("points_delta").notNull(),
  note: text("note"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

export const dailySummaries = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  sentAt: timestamp("sent_at"),
  status: text("status").default("PENDING").notNull(), // PENDING, SENT, FAILED
  error: text("error"),
});

// Schemas
export const insertChoreSchema = createInsertSchema(chores).omit({ id: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });
export const insertRewardSchema = createInsertSchema(rewards).omit({ id: true });
export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true, purchasedAt: true });
export const insertLedgerEventSchema = createInsertSchema(ledgerEvents).omit({ id: true, occurredAt: true });

// Types
export type Chore = typeof chores.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type UserState = typeof userState.$inferSelect;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;
export type DailySummary = typeof dailySummaries.$inferSelect;

export type InsertChore = z.infer<typeof insertChoreSchema>;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type InsertLedgerEvent = z.infer<typeof insertLedgerEventSchema>;

export const BONUS_REASONS = [
  { id: "initiative", label: "Did it without being asked" },
  { id: "kindness", label: "Showed kindness" },
  { id: "teamwork", label: "Great teamwork" },
  { id: "honesty", label: "Was honest" },
  { id: "calm_response", label: "Stayed calm" },
  { id: "extra_effort", label: "Extra effort" },
] as const;

export type BonusReason = typeof BONUS_REASONS[number]["id"];

export const REWARD_CATEGORIES = [
  "Experiences",
  "Privileges",
  "Food Treats",
  "Creativity",
  "Family / Connection",
  "Skills / Sports",
  "Toys / Items",
  "Surprise",
  "Allowance",
] as const;

export type RewardCategory = typeof REWARD_CATEGORIES[number];
