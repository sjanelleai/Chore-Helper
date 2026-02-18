
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { sendDailySummaryEmail, type DailySummaryData } from "./email";

async function computeDailySummary(date?: string): Promise<DailySummaryData> {
  const today = date || new Date().toISOString().slice(0, 10);
  const events = await storage.getLedgerEventsForDate(today);
  const allChores = await storage.getChores();
  const state = await storage.getUserState();

  const choreCompletedToday = new Set(
    events
      .filter(e => e.type === "CHORE_COMPLETE")
      .map(e => e.refId)
  );
  const choreUncheckedToday = new Set(
    events
      .filter(e => e.type === "CHORE_UNCHECK")
      .map(e => e.refId)
  );
  const completedChores: string[] = [];
  const missedChores: string[] = [];
  allChores.forEach(c => {
    if (choreCompletedToday.has(c.name) && !choreUncheckedToday.has(c.name)) {
      completedChores.push(c.name);
    } else if (c.completed) {
      completedChores.push(c.name);
    } else {
      missedChores.push(c.name);
    }
  });

  const bonuses = events
    .filter(e => e.type === "BONUS_AWARD")
    .map(e => ({ reason: e.refId, points: e.pointsDelta, note: e.note }));

  const redemptions = events
    .filter(e => e.type === "REWARD_REDEEM")
    .map(e => ({ name: e.refId, cost: Math.abs(e.pointsDelta) }));

  const pointsEarnedToday = events.reduce((sum, e) => sum + e.pointsDelta, 0);

  return {
    date: today,
    completedChores,
    missedChores,
    bonuses,
    redemptions,
    pointsEarnedToday,
    currentBalance: state.totalPoints,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await storage.seedData();

  // Chores
  app.get(api.chores.list.path, async (_req, res) => {
    const chores = await storage.getChores();
    res.json(chores);
  });

  app.post(api.chores.toggle.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const result = await storage.toggleChore(id);
      const userState = await storage.getUserState();
      const newBadges = await storage.checkAndAwardBadges(userState.totalEarnedLifetime);
      res.json({ chore: result.chore, userState, newBadges });
    } catch (e) {
      res.status(404).json({ message: (e as Error).message });
    }
  });

  app.post(api.chores.reset.path, async (_req, res) => {
    await storage.resetChores();
    res.json({ message: "Chores reset for tomorrow!" });
  });

  // Rewards
  app.get(api.rewards.list.path, async (_req, res) => {
    const rewards = await storage.getRewards();
    res.json(rewards);
  });

  app.post(api.rewards.buy.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const result = await storage.buyReward(id);
      res.json(result);
    } catch (e: any) {
      if (e.message === "Not enough points" || e.message.includes("approval") || e.message.includes("Allowance")) {
        res.status(400).json({ message: e.message });
      } else {
        res.status(404).json({ message: e.message });
      }
    }
  });

  app.post(api.rewards.toggleApproval.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { approved } = api.rewards.toggleApproval.input.parse(req.body);
      const reward = await storage.toggleRewardApproval(id, approved);
      res.json(reward);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: e.errors[0].message });
      } else {
        res.status(404).json({ message: e.message });
      }
    }
  });

  // Badges
  app.get(api.badges.list.path, async (_req, res) => {
    const badges = await storage.getBadges();
    res.json(badges);
  });

  // User State
  app.get(api.user.get.path, async (_req, res) => {
    const state = await storage.getUserState();
    res.json(state);
  });

  app.put(api.user.updateSettings.path, async (req, res) => {
    try {
      const input = api.user.updateSettings.input.parse(req.body);
      const state = await storage.updateSettings(input);
      res.json(state);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: e.errors[0].message });
      } else {
        res.status(500).json({ message: e.message });
      }
    }
  });

  // Purchases
  app.get(api.user.purchases.path, async (_req, res) => {
    const purchases = await storage.getPurchases();
    res.json(purchases);
  });

  // Bonus
  app.post(api.bonus.award.path, async (req, res) => {
    try {
      const input = api.bonus.award.input.parse(req.body);
      const result = await storage.awardBonus(input.reason, input.points, input.note);
      const newBadges = await storage.checkAndAwardBadges(result.userState.totalEarnedLifetime);
      res.json({ ...result, newBadges });
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: e.errors[0].message });
      } else {
        res.status(400).json({ message: e.message });
      }
    }
  });

  // Ledger
  app.get(api.ledger.list.path, async (_req, res) => {
    const events = await storage.getLedgerEvents();
    res.json(events);
  });

  // Summary
  app.get(api.summary.daily.path, async (req, res) => {
    const date = (req.query.date as string) || undefined;
    const summary = await computeDailySummary(date);
    res.json(summary);
  });

  app.post(api.summary.sendEmail.path, async (_req, res) => {
    try {
      const state = await storage.getUserState();
      if (!state.parentEmail) {
        return res.status(400).json({ message: "No parent email configured. Please set it in Settings." });
      }
      const summary = await computeDailySummary();
      await sendDailySummaryEmail(state.parentEmail, summary);
      res.json({ message: "Summary email sent!" });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Failed to send email" });
    }
  });

  return httpServer;
}
