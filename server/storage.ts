import { db } from "./db";
import {
  userState, dailyStatus, badges, purchases, ledgerEvents,
  type UserState, type DailyStatus, type Badge, type Purchase, type LedgerEvent,
  type EnabledChore, type EnabledReward,
} from "@shared/schema";
import {
  CATALOG, STARTER_CHORES, STARTER_REWARDS,
  flattenCatalog, findCategoryName, clampNumber, localDateKey,
} from "@shared/catalog";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getUserState(): Promise<UserState>;
  updateSettings(settings: Partial<Pick<UserState, 'parentEmail' | 'allowanceEnabled' | 'pointsPerDollar'>>): Promise<UserState>;
  updateChoreConfig(enabledChores: Record<string, boolean>, pointsByChoreId: Record<string, number>): Promise<UserState>;
  updateRewardConfig(enabledRewards: Record<string, boolean>, costByRewardId: Record<string, number>): Promise<UserState>;
  getEnabledChores(): Promise<EnabledChore[]>;
  getEnabledRewards(): Promise<EnabledReward[]>;
  getDailyStatus(): Promise<DailyStatus>;
  toggleChore(choreId: string): Promise<{ chore: EnabledChore; pointsDelta: number; userState: UserState }>;
  resetDaily(): Promise<void>;
  redeemReward(rewardId: string): Promise<{ purchase: Purchase; userState: UserState }>;
  getBadges(): Promise<Badge[]>;
  checkAndAwardBadges(totalLifetimePoints: number): Promise<Badge[]>;
  getPurchases(): Promise<Purchase[]>;
  awardBonus(reason: string, points: number, note?: string): Promise<{ event: LedgerEvent; userState: UserState }>;
  addLedgerEvent(type: string, refId: string, pointsDelta: number, note?: string): Promise<LedgerEvent>;
  getLedgerEvents(): Promise<LedgerEvent[]>;
  getLedgerEventsForDate(date: string): Promise<LedgerEvent[]>;
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {

  async getUserState(): Promise<UserState> {
    const rows = await db.select().from(userState).limit(1);
    if (rows.length === 0) {
      const enabledChores: Record<string, boolean> = {};
      const enabledRewards: Record<string, boolean> = {};
      const pointsByChoreId: Record<string, number> = {};
      const costByRewardId: Record<string, number> = {};

      flattenCatalog(CATALOG.chores).forEach(c => {
        enabledChores[c.id] = STARTER_CHORES.includes(c.id);
        pointsByChoreId[c.id] = c.defaultPoints;
      });
      flattenCatalog(CATALOG.rewards).forEach(r => {
        const isAllowance = r.id.startsWith("allow_");
        enabledRewards[r.id] = STARTER_REWARDS.includes(r.id) && !isAllowance;
        costByRewardId[r.id] = r.defaultCost;
      });

      const [newState] = await db.insert(userState).values({
        totalPoints: 0,
        totalEarnedLifetime: 0,
        allowanceEnabled: false,
        pointsPerDollar: 600,
        enabledChores,
        enabledRewards,
        pointsByChoreId,
        costByRewardId,
      }).returning();
      return newState;
    }
    return rows[0];
  }

  async updateSettings(settings: Partial<Pick<UserState, 'parentEmail' | 'allowanceEnabled' | 'pointsPerDollar'>>): Promise<UserState> {
    const state = await this.getUserState();
    const updateData: any = { ...settings };

    if (settings.allowanceEnabled !== undefined) {
      const ppd = clampNumber(settings.pointsPerDollar ?? state.pointsPerDollar, 50, 5000);
      const costByRewardId = (state.costByRewardId as Record<string, number>) || {};
      costByRewardId["allow_1"] = ppd * 1;
      costByRewardId["allow_5"] = ppd * 5;
      costByRewardId["allow_10"] = ppd * 10;
      updateData.costByRewardId = costByRewardId;
      updateData.pointsPerDollar = ppd;

      if (!settings.allowanceEnabled) {
        const enabledRewards = (state.enabledRewards as Record<string, boolean>) || {};
        Object.keys(enabledRewards).forEach(id => {
          if (id.startsWith("allow_")) enabledRewards[id] = false;
        });
        updateData.enabledRewards = enabledRewards;
      }
    }

    const [updated] = await db.update(userState)
      .set(updateData)
      .where(eq(userState.id, state.id))
      .returning();
    return updated;
  }

  async updateChoreConfig(enabledChores: Record<string, boolean>, pointsByChoreId: Record<string, number>): Promise<UserState> {
    const state = await this.getUserState();
    const existingEnabled = (state.enabledChores as Record<string, boolean>) || {};
    const existingPoints = (state.pointsByChoreId as Record<string, number>) || {};

    const merged = { ...existingEnabled, ...enabledChores };
    const mergedPoints = { ...existingPoints, ...pointsByChoreId };

    const [updated] = await db.update(userState)
      .set({ enabledChores: merged, pointsByChoreId: mergedPoints })
      .where(eq(userState.id, state.id))
      .returning();
    return updated;
  }

  async updateRewardConfig(enabledRewards: Record<string, boolean>, costByRewardId: Record<string, number>): Promise<UserState> {
    const state = await this.getUserState();
    const existingEnabled = (state.enabledRewards as Record<string, boolean>) || {};
    const existingCosts = (state.costByRewardId as Record<string, number>) || {};

    const merged = { ...existingEnabled, ...enabledRewards };
    const mergedCosts = { ...existingCosts, ...costByRewardId };

    const [updated] = await db.update(userState)
      .set({ enabledRewards: merged, costByRewardId: mergedCosts })
      .where(eq(userState.id, state.id))
      .returning();
    return updated;
  }

  async getEnabledChores(): Promise<EnabledChore[]> {
    const state = await this.getUserState();
    const daily = await this.getDailyStatus();
    const enabledMap = (state.enabledChores as Record<string, boolean>) || {};
    const pointsMap = (state.pointsByChoreId as Record<string, number>) || {};
    const completedMap = (daily.completedChores as Record<string, boolean>) || {};

    const allChores = flattenCatalog(CATALOG.chores);
    return allChores
      .filter(c => enabledMap[c.id])
      .map(c => ({
        id: c.id,
        name: c.name,
        points: clampNumber(pointsMap[c.id] ?? c.defaultPoints, 0, 999999),
        completed: Boolean(completedMap[c.id]),
        categoryName: findCategoryName(CATALOG.chores, c.id),
      }));
  }

  async getEnabledRewards(): Promise<EnabledReward[]> {
    const state = await this.getUserState();
    const enabledMap = (state.enabledRewards as Record<string, boolean>) || {};
    const costMap = (state.costByRewardId as Record<string, number>) || {};

    const allRewards = flattenCatalog(CATALOG.rewards);
    return allRewards
      .filter(r => {
        if (r.id.startsWith("allow_") && !state.allowanceEnabled) return false;
        return enabledMap[r.id];
      })
      .map(r => ({
        id: r.id,
        name: r.name,
        cost: clampNumber(costMap[r.id] ?? r.defaultCost, 0, 999999),
        category: findCategoryName(CATALOG.rewards, r.id),
      }));
  }

  async getDailyStatus(): Promise<DailyStatus> {
    const today = localDateKey(new Date());
    const rows = await db.select().from(dailyStatus).where(eq(dailyStatus.dateKey, today)).limit(1);
    if (rows.length === 0) {
      const [newStatus] = await db.insert(dailyStatus).values({
        dateKey: today,
        completedChores: {},
      }).returning();
      return newStatus;
    }
    return rows[0];
  }

  async toggleChore(choreId: string): Promise<{ chore: EnabledChore; pointsDelta: number; userState: UserState }> {
    const state = await this.getUserState();
    const enabledMap = (state.enabledChores as Record<string, boolean>) || {};
    if (!enabledMap[choreId]) throw new Error("Chore not enabled");

    const daily = await this.getDailyStatus();
    const completedMap = (daily.completedChores as Record<string, boolean>) || {};
    const wasDone = Boolean(completedMap[choreId]);
    const nowDone = !wasDone;

    completedMap[choreId] = nowDone;
    await db.update(dailyStatus)
      .set({ completedChores: completedMap })
      .where(eq(dailyStatus.id, daily.id));

    const pointsMap = (state.pointsByChoreId as Record<string, number>) || {};
    const choreItem = flattenCatalog(CATALOG.chores).find(c => c.id === choreId);
    const pts = clampNumber(pointsMap[choreId] ?? choreItem?.defaultPoints ?? 0, 0, 999999);
    const pointsDelta = nowDone ? pts : -pts;

    let newTotal = Math.max(0, state.totalPoints + pointsDelta);
    const updateData: any = { totalPoints: newTotal };
    if (nowDone) {
      updateData.totalEarnedLifetime = state.totalEarnedLifetime + pts;
    }

    const [newState] = await db.update(userState)
      .set(updateData)
      .where(eq(userState.id, state.id))
      .returning();

    await this.addLedgerEvent(
      nowDone ? "chore_completed" : "chore_unchecked",
      choreId,
      pointsDelta,
    );

    const chore: EnabledChore = {
      id: choreId,
      name: choreItem?.name || choreId,
      points: pts,
      completed: nowDone,
      categoryName: findCategoryName(CATALOG.chores, choreId),
    };

    return { chore, pointsDelta, userState: newState };
  }

  async resetDaily(): Promise<void> {
    const today = localDateKey(new Date());
    const rows = await db.select().from(dailyStatus).where(eq(dailyStatus.dateKey, today)).limit(1);
    if (rows.length > 0) {
      await db.update(dailyStatus)
        .set({ completedChores: {} })
        .where(eq(dailyStatus.id, rows[0].id));
    }
  }

  async redeemReward(rewardId: string): Promise<{ purchase: Purchase; userState: UserState }> {
    const state = await this.getUserState();
    const enabledMap = (state.enabledRewards as Record<string, boolean>) || {};
    if (!enabledMap[rewardId]) throw new Error("Reward not enabled");

    if (rewardId.startsWith("allow_") && !state.allowanceEnabled) {
      throw new Error("Allowance is not enabled");
    }

    const rewardItem = flattenCatalog(CATALOG.rewards).find(r => r.id === rewardId);
    if (!rewardItem) throw new Error("Reward not found in catalog");

    const costMap = (state.costByRewardId as Record<string, number>) || {};
    const cost = clampNumber(costMap[rewardId] ?? rewardItem.defaultCost, 0, 999999);

    if (state.totalPoints < cost) throw new Error("Not enough points");

    const [newState] = await db.update(userState)
      .set({ totalPoints: state.totalPoints - cost })
      .where(eq(userState.id, state.id))
      .returning();

    const [purchase] = await db.insert(purchases).values({
      rewardId,
      rewardName: rewardItem.name,
      cost,
    }).returning();

    await this.addLedgerEvent("purchase", rewardId, -cost);

    return { purchase, userState: newState };
  }

  async getBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(badges.threshold);
  }

  async checkAndAwardBadges(totalLifetimePoints: number): Promise<Badge[]> {
    const allBadges = await db.select().from(badges);
    const newlyEarned = allBadges.filter(b => !b.earned && b.threshold <= totalLifetimePoints);

    for (const badge of newlyEarned) {
      await db.update(badges).set({ earned: true }).where(eq(badges.id, badge.id));
    }

    return newlyEarned;
  }

  async getPurchases(): Promise<Purchase[]> {
    return await db.select().from(purchases).orderBy(desc(purchases.purchasedAt));
  }

  async awardBonus(reason: string, points: number, note?: string): Promise<{ event: LedgerEvent; userState: UserState }> {
    const p = clampNumber(points, 0, 5000);
    const state = await this.getUserState();
    const newTotal = state.totalPoints + p;
    const newLifetime = state.totalEarnedLifetime + p;

    const [newState] = await db.update(userState)
      .set({ totalPoints: newTotal, totalEarnedLifetime: newLifetime })
      .where(eq(userState.id, state.id))
      .returning();

    const event = await this.addLedgerEvent("bonus_award", reason, p, note);

    return { event, userState: newState };
  }

  async addLedgerEvent(type: string, refId: string, pointsDelta: number, note?: string): Promise<LedgerEvent> {
    const [event] = await db.insert(ledgerEvents).values({
      type,
      refId,
      pointsDelta,
      note: note || null,
    }).returning();
    return event;
  }

  async getLedgerEvents(): Promise<LedgerEvent[]> {
    return await db.select().from(ledgerEvents).orderBy(desc(ledgerEvents.occurredAt)).limit(100);
  }

  async getLedgerEventsForDate(date: string): Promise<LedgerEvent[]> {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    return await db.select().from(ledgerEvents)
      .where(and(
        gte(ledgerEvents.occurredAt, startOfDay),
        lte(ledgerEvents.occurredAt, endOfDay),
      ))
      .orderBy(ledgerEvents.occurredAt);
  }

  async seedData(): Promise<void> {
    await this.getUserState();

    const existingBadges = await this.getBadges();
    if (existingBadges.length > 0) return;

    await db.insert(badges).values([
      { name: "Starter Badge", threshold: 50, icon: "medal_bronze", description: "Earn your first 50 points!" },
      { name: "Helper Level 2", threshold: 150, icon: "medal_silver", description: "Getting serious!" },
      { name: "Chore Master", threshold: 300, icon: "medal_gold", description: "Legendary status!" },
      { name: "Super Star", threshold: 500, icon: "star", description: "500 points earned!" },
      { name: "Champion", threshold: 1000, icon: "trophy", description: "Unstoppable!" },
      { name: "Legend", threshold: 2000, icon: "crown", description: "Absolute legend!" },
    ]);
  }
}

export const storage = new DatabaseStorage();
