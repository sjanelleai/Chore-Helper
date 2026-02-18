import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { CATALOG, flattenCatalog, localDateKey } from "@shared/catalog";
import { z } from "zod";
import { sendDailySummaryEmail, type DailySummaryData } from "./email";

async function computeDailySummary(date?: string): Promise<DailySummaryData> {
  const today = date || localDateKey(new Date());
  const events = await storage.getLedgerEventsForDate(today);
  const enabledChores = await storage.getEnabledChores();
  const state = await storage.getUserState();

  const completedSet = new Set(
    events.filter(e => e.type === "chore_completed").map(e => e.refId)
  );
  const uncheckedSet = new Set(
    events.filter(e => e.type === "chore_unchecked").map(e => e.refId)
  );

  const completedChores: string[] = [];
  const missedChores: string[] = [];
  enabledChores.forEach(c => {
    if (c.completed) {
      completedChores.push(c.name);
    } else {
      missedChores.push(c.name);
    }
  });

  const bonuses = events
    .filter(e => e.type === "bonus_award")
    .map(e => ({ reason: e.refId, points: e.pointsDelta, note: e.note }));

  const redemptions = events
    .filter(e => e.type === "purchase")
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await storage.seedData();

  // Chores (enabled only)
  app.get(api.chores.list.path, async (_req, res) => {
    const chores = await storage.getEnabledChores();
    res.json(chores);
  });

  app.post(api.chores.toggle.path, async (req, res) => {
    try {
      const choreId = req.params.choreId;
      const result = await storage.toggleChore(choreId);
      const newBadges = await storage.checkAndAwardBadges(result.userState.totalEarnedLifetime);
      res.json({ chore: result.chore, userState: result.userState, newBadges });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post(api.chores.reset.path, async (_req, res) => {
    await storage.resetDaily();
    res.json({ message: "Chores reset for tomorrow!" });
  });

  // Rewards (enabled only)
  app.get(api.rewards.list.path, async (_req, res) => {
    const rewards = await storage.getEnabledRewards();
    res.json(rewards);
  });

  app.post(api.rewards.redeem.path, async (req, res) => {
    try {
      const rewardId = req.params.rewardId;
      const result = await storage.redeemReward(rewardId);
      res.json(result);
    } catch (e: any) {
      if (e.message === "Not enough points" || e.message.includes("not enabled") || e.message.includes("Allowance")) {
        res.status(400).json({ message: e.message });
      } else {
        res.status(404).json({ message: e.message });
      }
    }
  });

  // Badges
  app.get(api.badges.list.path, async (_req, res) => {
    const b = await storage.getBadges();
    res.json(b);
  });

  // User
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

  app.get(api.user.purchases.path, async (_req, res) => {
    const p = await storage.getPurchases();
    res.json(p);
  });

  // Config (parent admin)
  app.get(api.config.get.path, async (_req, res) => {
    const state = await storage.getUserState();
    res.json({
      enabledChores: state.enabledChores,
      enabledRewards: state.enabledRewards,
      pointsByChoreId: state.pointsByChoreId,
      costByRewardId: state.costByRewardId,
      allowanceEnabled: state.allowanceEnabled,
      pointsPerDollar: state.pointsPerDollar,
    });
  });

  app.put(api.config.updateChores.path, async (req, res) => {
    try {
      const input = api.config.updateChores.input.parse(req.body);
      const state = await storage.updateChoreConfig(input.enabledChores, input.pointsByChoreId);
      res.json(state);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put(api.config.updateRewards.path, async (req, res) => {
    try {
      const input = api.config.updateRewards.input.parse(req.body);
      const state = await storage.updateRewardConfig(input.enabledRewards, input.costByRewardId);
      res.json(state);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Bonus
  app.post(api.bonus.award.path, async (req, res) => {
    try {
      const input = api.bonus.award.input.parse(req.body);
      const result = await storage.awardBonus(input.reason, input.points, input.note);
      const newBadges = await storage.checkAndAwardBadges(result.userState.totalEarnedLifetime);
      res.json({ ...result, newBadges });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
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
