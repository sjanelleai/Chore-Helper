
import { db } from "./db";
import {
  chores, badges, rewards, purchases, userState,
  type Chore, type Badge, type Reward, type Purchase, type UserState,
  type InsertChore, type InsertReward
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // Chores
  getChores(): Promise<Chore[]>;
  toggleChore(id: number): Promise<{ chore: Chore, pointsDelta: number }>;
  resetChores(): Promise<void>;
  
  // Rewards & Store
  getRewards(): Promise<Reward[]>;
  buyReward(rewardId: number): Promise<{ purchase: Purchase, userState: UserState }>;
  
  // Badges
  getBadges(): Promise<Badge[]>;
  checkAndAwardBadges(totalLifetimePoints: number): Promise<Badge[]>; // Returns newly earned badges
  
  // User State
  getUserState(): Promise<UserState>;
  getPurchases(): Promise<Purchase[]>;
  
  // Seeding/Admin
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  
  // --- User State Helper ---
  async getUserState(): Promise<UserState> {
    let state = await db.select().from(userState).limit(1);
    if (state.length === 0) {
      const [newState] = await db.insert(userState).values({ totalPoints: 0, totalEarnedLifetime: 0 }).returning();
      return newState;
    }
    return state[0];
  }

  // --- Chores ---
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
    
    // Update user points
    const state = await this.getUserState();
    let newTotal = state.totalPoints + pointsDelta;
    if (newTotal < 0) newTotal = 0; // Prevent negative spendable points
    
    let newLifetime = state.totalEarnedLifetime;
    if (newCompleted) {
        newLifetime += current.points;
    } else {
        // If unchecking, we might want to reduce lifetime points too to prevent spam-toggling for badges?
        // Or strictly strictly only add to lifetime. 
        // For simple anti-cheat, let's reduce lifetime too if unchecked.
        newLifetime -= current.points;
        if (newLifetime < 0) newLifetime = 0;
    }

    await db.update(userState)
      .set({ 
        totalPoints: newTotal,
        totalEarnedLifetime: newLifetime
      })
      .where(eq(userState.id, state.id));

    return { chore: updated, pointsDelta };
  }

  async resetChores(): Promise<void> {
    await db.update(chores).set({ completed: false });
  }

  // --- Rewards ---
  async getRewards(): Promise<Reward[]> {
    return await db.select().from(rewards).orderBy(rewards.cost);
  }

  async buyReward(rewardId: number): Promise<{ purchase: Purchase, userState: UserState }> {
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, rewardId));
    if (!reward) throw new Error("Reward not found");

    const state = await this.getUserState();
    if (state.totalPoints < reward.cost) {
      throw new Error("Not enough points");
    }

    // Deduct points
    const [newState] = await db.update(userState)
      .set({ totalPoints: state.totalPoints - reward.cost })
      .where(eq(userState.id, state.id))
      .returning();

    // Log purchase
    const [purchase] = await db.insert(purchases).values({
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
    }).returning();

    return { purchase, userState: newState };
  }

  // --- Badges ---
  async getBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(badges.threshold);
  }

  async checkAndAwardBadges(totalLifetimePoints: number): Promise<Badge[]> {
    // Find unearned badges that are now crossed
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

  // --- Seeding ---
  async seedData(): Promise<void> {
    const existingChores = await this.getChores();
    if (existingChores.length > 0) return;

    // Chores
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

    // Badges
    await db.insert(badges).values([
      { name: "Starter Badge", threshold: 50, icon: "🥉", description: "Earn your first 50 points!" },
      { name: "Helper Level 2", threshold: 150, icon: "🥈", description: "Getting serious!" },
      { name: "Chore Master", threshold: 300, icon: "🥇", description: "Legendary status!" },
      { name: "Super Star", threshold: 1000, icon: "⭐", description: "Unstoppable!" },
    ]);

    // Rewards
    await db.insert(rewards).values([
      { name: "Pick a family game", cost: 60, icon: "🎲" },
      { name: "Treat / Food", cost: 75, icon: "🍦" },
      { name: "Build a house (creative time)", cost: 120, icon: "🏰" },
      { name: "Arcade Trip", cost: 200, icon: "🕹️" },
    ]);
    
    // Ensure user state exists
    await this.getUserState();
  }
}

export const storage = new DatabaseStorage();
