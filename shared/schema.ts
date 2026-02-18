import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userState = pgTable("user_state", {
  id: serial("id").primaryKey(),
  totalPoints: integer("total_points").default(0).notNull(),
  totalEarnedLifetime: integer("total_earned_lifetime").default(0).notNull(),
  parentEmail: text("parent_email"),
  allowanceEnabled: boolean("allowance_enabled").default(false).notNull(),
  pointsPerDollar: integer("points_per_dollar").default(600).notNull(),
  enabledChores: jsonb("enabled_chores").default({}).notNull(),
  enabledRewards: jsonb("enabled_rewards").default({}).notNull(),
  pointsByChoreId: jsonb("points_by_chore_id").default({}).notNull(),
  costByRewardId: jsonb("cost_by_reward_id").default({}).notNull(),
});

export const dailyStatus = pgTable("daily_status", {
  id: serial("id").primaryKey(),
  dateKey: text("date_key").notNull(),
  completedChores: jsonb("completed_chores").default({}).notNull(),
});

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  threshold: integer("threshold").notNull(),
  icon: text("icon").notNull(),
  earned: boolean("earned").default(false).notNull(),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  rewardId: text("reward_id").notNull(),
  rewardName: text("reward_name").notNull(),
  cost: integer("cost").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

export const ledgerEvents = pgTable("ledger_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  refId: text("ref_id").notNull(),
  pointsDelta: integer("points_delta").notNull(),
  note: text("note"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

export type UserState = typeof userState.$inferSelect;
export type DailyStatus = typeof dailyStatus.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;

export interface EnabledChore {
  id: string;
  name: string;
  points: number;
  completed: boolean;
  categoryName: string;
}

export interface EnabledReward {
  id: string;
  name: string;
  cost: number;
  category: string;
}
