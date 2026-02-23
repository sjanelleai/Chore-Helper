import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export interface EnabledChore {
  id: string;
  title: string;
  points: number;
  completed: boolean;
  status: "approved" | "pending" | "unchecked";
  categoryName: string;
}

export interface EnabledReward {
  id: string;
  title: string;
  cost: number;
  category: string;
}

export interface ChoreCatalogRow {
  id: string;
  family_id: string;
  category: string;
  title: string;
  points: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RewardCatalogRow {
  id: string;
  family_id: string;
  category: string;
  title: string;
  cost: number;
  requires_parent_approval: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PointsLedgerRow {
  id: string;
  family_id: string;
  child_id: string;
  event_type: string;
  points_delta: number;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
}

export interface RewardRedemptionRow {
  id: string;
  family_id: string;
  child_id: string;
  reward_id: string;
  cost: number;
  status: string;
  created_at: string;
}

export interface DailyStatusRow {
  child_id: string;
  chore_id: string;
  date_key: string;
  completed: boolean;
  created_at: string;
}
