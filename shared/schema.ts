import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export interface ChoreCatalogRow {
  id: string;
  family_id: string;
  category: string;
  name: string;
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
  name: string;
  cost: number;
  requires_approval: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PointsLedgerRow {
  id: string;
  family_id: string;
  child_id: string | null;
  date_key: string;
  event_type: string;
  ref_id: string | null;
  points_delta: number;
  meta: Record<string, any>;
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
  updated_at: string;
}

export interface DailyStatusRow {
  child_id: string;
  date_key: string;
  completed_chore_ids: string[];
  points_earned: number;
  created_at: string;
  updated_at: string;
}
