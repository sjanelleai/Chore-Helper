
import { db } from "./db";
import {
  chores, badges, rewards, purchases, userState, ledgerEvents, dailySummaries,
  type Chore, type Badge, type Reward, type Purchase, type UserState, type LedgerEvent, type DailySummary,
} from "@shared/schema";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";

export interface IStorage {
  getChores(): Promise<Chore[]>;
  toggleChore(id: number): Promise<{ chore: Chore, pointsDelta: number }>;
  resetChores(): Promise<void>;
  getRewards(): Promise<Reward[]>;
  buyReward(rewardId: number): Promise<{ purchase: Purchase, userState: UserState }>;
  toggleRewardApproval(id: number, approved: boolean): Promise<Reward>;
  getBadges(): Promise<Badge[]>;
  checkAndAwardBadges(totalLifetimePoints: number): Promise<Badge[]>;
  getUserState(): Promise<UserState>;
  updateSettings(settings: Partial<Pick<UserState, 'parentEmail' | 'timezone' | 'dailySummaryTime' | 'allowanceEnabled' | 'pointsPerDollar'>>): Promise<UserState>;
  getPurchases(): Promise<Purchase[]>;
  awardBonus(reason: string, points: number, note?: string): Promise<{ event: LedgerEvent, userState: UserState }>;
  addLedgerEvent(type: string, refId: string, pointsDelta: number, note?: string): Promise<LedgerEvent>;
  getLedgerEvents(): Promise<LedgerEvent[]>;
  getLedgerEventsForDate(date: string): Promise<LedgerEvent[]>;
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {

  async getUserState(): Promise<UserState> {
    let state = await db.select().from(userState).limit(1);
    if (state.length === 0) {
      const [newState] = await db.insert(userState).values({
        totalPoints: 0,
        totalEarnedLifetime: 0,
        allowanceEnabled: false,
        pointsPerDollar: 300,
      }).returning();
      return newState;
    }
    return state[0];
  }

  async updateSettings(settings: Partial<Pick<UserState, 'parentEmail' | 'timezone' | 'dailySummaryTime' | 'allowanceEnabled' | 'pointsPerDollar'>>): Promise<UserState> {
    const state = await this.getUserState();
    const [updated] = await db.update(userState)
      .set(settings)
      .where(eq(userState.id, state.id))
      .returning();
    return updated;
  }

  async getChores(): Promise<Chore[]> {
    return await db.select().from(chores).orderBy(chores.id);
  }

  async toggleChore(id: number): Promise<{ chore: Chore, pointsDelta: number }> {
    const [current] = await db.select().from(chores).where(eq(chores.id, id));
    if (!current) throw new Error("Chore not found");

    const newCompleted = !current.completed;
    const [updated] = await db.update(chores)
      .set({ completed: newCompleted })
      .where(eq(chores.id, id))
      .returning();

    const pointsDelta = newCompleted ? current.points : -current.points;

    const state = await this.getUserState();
    let newTotal = state.totalPoints + pointsDelta;
    if (newTotal < 0) newTotal = 0;

    const updateData: any = { totalPoints: newTotal };
    if (newCompleted) {
      updateData.totalEarnedLifetime = state.totalEarnedLifetime + current.points;
    }

    await db.update(userState)
      .set(updateData)
      .where(eq(userState.id, state.id));

    await this.addLedgerEvent(
      newCompleted ? "CHORE_COMPLETE" : "CHORE_UNCHECK",
      current.name,
      pointsDelta,
    );

    return { chore: updated, pointsDelta };
  }

  async resetChores(): Promise<void> {
    await db.update(chores).set({ completed: false });
  }

  async getRewards(): Promise<Reward[]> {
    return await db.select().from(rewards).where(eq(rewards.active, true)).orderBy(rewards.category, rewards.cost);
  }

  async toggleRewardApproval(id: number, approved: boolean): Promise<Reward> {
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    if (!reward) throw new Error("Reward not found");

    const [updated] = await db.update(rewards)
      .set({ approved })
      .where(eq(rewards.id, id))
      .returning();
    return updated;
  }

  async buyReward(rewardId: number): Promise<{ purchase: Purchase, userState: UserState }> {
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, rewardId));
    if (!reward) throw new Error("Reward not found");
    if (!reward.approved) throw new Error("This reward needs parent approval first");

    const state = await this.getUserState();
    if (state.totalPoints < reward.cost) {
      throw new Error("Not enough points");
    }

    if (reward.isAllowance && !state.allowanceEnabled) {
      throw new Error("Allowance is not enabled");
    }

    const [newState] = await db.update(userState)
      .set({ totalPoints: state.totalPoints - reward.cost })
      .where(eq(userState.id, state.id))
      .returning();

    const [purchase] = await db.insert(purchases).values({
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
    }).returning();

    await this.addLedgerEvent("REWARD_REDEEM", reward.name, -reward.cost);

    return { purchase, userState: newState };
  }

  async getBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(badges.threshold);
  }

  async checkAndAwardBadges(totalLifetimePoints: number): Promise<Badge[]> {
    const newlyEarned = await db.select().from(badges)
      .where(sql`${badges.earned} = false AND ${badges.threshold} <= ${totalLifetimePoints}`);

    if (newlyEarned.length > 0) {
      const ids = newlyEarned.map(b => b.id);
      await db.update(badges).set({ earned: true }).where(sql`${badges.id} IN ${ids}`);
    }

    return newlyEarned;
  }

  async getPurchases(): Promise<Purchase[]> {
    return await db.select().from(purchases).orderBy(sql`${purchases.purchasedAt} DESC`);
  }

  async awardBonus(reason: string, points: number, note?: string): Promise<{ event: LedgerEvent, userState: UserState }> {
    const state = await this.getUserState();
    const newTotal = state.totalPoints + points;
    const newLifetime = state.totalEarnedLifetime + points;

    const [newState] = await db.update(userState)
      .set({ totalPoints: newTotal, totalEarnedLifetime: newLifetime })
      .where(eq(userState.id, state.id))
      .returning();

    const event = await this.addLedgerEvent("BONUS_AWARD", reason, points, note);

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
    const existingChores = await this.getChores();
    if (existingChores.length > 0) return;

    await db.insert(chores).values([
      { name: "Make bed", points: 10, section: "morning", icon: "🛏️" },
      { name: "Put clothes in hamper", points: 10, section: "morning", icon: "🧺" },
      { name: "Clean room (quick)", points: 30, section: "general", icon: "🧹" },
      { name: "Clean room (deep)", points: 100, section: "general", icon: "🧼" },
      { name: "Dishes helper", points: 25, section: "general", icon: "🍽️" },
      { name: "Feed pet", points: 15, section: "bedtime", icon: "🐾" },
      { name: "Homework done", points: 50, section: "afterSchool", icon: "📚" },
      { name: "Pick up toys", points: 15, section: "afterSchool", icon: "🧸" },
    ]);

    await db.insert(badges).values([
      { name: "Starter Badge", threshold: 50, icon: "🥉", description: "Earn your first 50 points!" },
      { name: "Helper Level 2", threshold: 150, icon: "🥈", description: "Getting serious!" },
      { name: "Chore Master", threshold: 300, icon: "🥇", description: "Legendary status!" },
      { name: "Super Star", threshold: 500, icon: "⭐", description: "500 points earned!" },
      { name: "Champion", threshold: 1000, icon: "🏆", description: "Unstoppable!" },
      { name: "Legend", threshold: 2000, icon: "👑", description: "Absolute legend!" },
    ]);

    await db.insert(rewards).values([
      // Experiences (700-1200+)
      { name: "Arcade Trip", cost: 900, icon: "🕹️", category: "Experiences", approved: false },
      { name: "Movie Night Out", cost: 1000, icon: "🎬", category: "Experiences", approved: false },
      { name: "Bowling", cost: 800, icon: "🎳", category: "Experiences", approved: false },
      { name: "Mini Golf", cost: 700, icon: "⛳", category: "Experiences", approved: false },
      { name: "Water Park", cost: 1200, icon: "🏊", category: "Experiences", approved: false },
      // Privileges (400-1800)
      { name: "Stay Up 30 Min Late", cost: 400, icon: "🌙", category: "Privileges", approved: false },
      { name: "Extra Screen Time (1hr)", cost: 500, icon: "📱", category: "Privileges", approved: false },
      { name: "Pick Dinner Menu", cost: 450, icon: "🍕", category: "Privileges", approved: false },
      { name: "No Chores Day", cost: 1800, icon: "🎉", category: "Privileges", approved: false },
      { name: "Sleepover with Friend", cost: 1500, icon: "🏠", category: "Privileges", approved: false },
      // Food Treats (300-800)
      { name: "Ice Cream", cost: 300, icon: "🍦", category: "Food Treats", approved: false },
      { name: "Special Snack", cost: 350, icon: "🍿", category: "Food Treats", approved: false },
      { name: "Bake Cookies Together", cost: 400, icon: "🍪", category: "Food Treats", approved: false },
      { name: "Restaurant Meal", cost: 800, icon: "🍔", category: "Food Treats", approved: false },
      { name: "Smoothie Run", cost: 450, icon: "🥤", category: "Food Treats", approved: false },
      // Creativity (450-900)
      { name: "Art Supplies", cost: 600, icon: "🎨", category: "Creativity", approved: false },
      { name: "Build a Fort", cost: 450, icon: "🏰", category: "Creativity", approved: false },
      { name: "Craft Project", cost: 500, icon: "✂️", category: "Creativity", approved: false },
      { name: "LEGO Set", cost: 900, icon: "🧱", category: "Creativity", approved: false },
      // Family / Connection (500-800)
      { name: "Pick a Family Game", cost: 500, icon: "🎲", category: "Family / Connection", approved: false },
      { name: "Family Movie Pick", cost: 600, icon: "🎥", category: "Family / Connection", approved: false },
      { name: "Parent Date (1-on-1)", cost: 700, icon: "❤️", category: "Family / Connection", approved: false },
      { name: "Campfire + S'mores", cost: 800, icon: "🔥", category: "Family / Connection", approved: false },
      // Skills / Sports (450-650)
      { name: "New Book", cost: 450, icon: "📖", category: "Skills / Sports", approved: false },
      { name: "Sports Equipment", cost: 650, icon: "⚽", category: "Skills / Sports", approved: false },
      { name: "Bike Ride Adventure", cost: 500, icon: "🚴", category: "Skills / Sports", approved: false },
      // Toys / Items (800-2500+)
      { name: "Small Toy", cost: 800, icon: "🧸", category: "Toys / Items", approved: false },
      { name: "Trading Cards Pack", cost: 900, icon: "🃏", category: "Toys / Items", approved: false },
      { name: "Big Toy", cost: 2500, icon: "🎁", category: "Toys / Items", approved: false },
      // Surprise (900-2200+)
      { name: "Mystery Surprise", cost: 900, icon: "🎊", category: "Surprise", approved: false },
      { name: "Big Surprise", cost: 2200, icon: "🌟", category: "Surprise", approved: false },
      // Allowance
      { name: "$1 Allowance", cost: 300, icon: "💵", category: "Allowance", approved: false, isAllowance: true },
      { name: "$5 Allowance", cost: 1500, icon: "💰", category: "Allowance", approved: false, isAllowance: true },
      { name: "$10 Allowance", cost: 3000, icon: "🤑", category: "Allowance", approved: false, isAllowance: true },
    ]);

    await this.getUserState();
  }
}

export const storage = new DatabaseStorage();
