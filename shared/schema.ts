
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We'll use a simple model where we track the current state of the application
// For a multi-user app we'd add user_id, but for this MVP we'll assume single-family/single-user context
// or just seed a default user.

export const chores = pgTable("chores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  points: integer("points").notNull(),
  icon: text("icon"), // Emoji or icon name
  section: text("section").default("general"), // 'morning', 'afterSchool', 'bedtime', 'general'
  completed: boolean("completed").default(false).notNull(),
});

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  threshold: integer("threshold").notNull(), // Points needed
  icon: text("icon").notNull(),
  earned: boolean("earned").default(false).notNull(),
});

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cost: integer("cost").notNull(),
  icon: text("icon"),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id").notNull(),
  rewardName: text("reward_name").notNull(), // Snapshot name in case reward changes
  cost: integer("cost").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

// Global state for the user (points balance)
export const userState = pgTable("user_state", {
  id: serial("id").primaryKey(),
  totalPoints: integer("total_points").default(0).notNull(),
  totalEarnedLifetime: integer("total_earned_lifetime").default(0).notNull(), // To track badges independently of current spendable balance
});

// Schemas
export const insertChoreSchema = createInsertSchema(chores).omit({ id: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });
export const insertRewardSchema = createInsertSchema(rewards).omit({ id: true });
export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true, purchasedAt: true });

// Types
export type Chore = typeof chores.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type UserState = typeof userState.$inferSelect;

export type InsertChore = z.infer<typeof insertChoreSchema>;
export type InsertReward = z.infer<typeof insertRewardSchema>;
