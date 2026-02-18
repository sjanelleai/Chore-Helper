
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed data on startup
  await storage.seedData();

  // Chores List
  app.get(api.chores.list.path, async (req, res) => {
    const chores = await storage.getChores();
    res.json(chores);
  });

  // Toggle Chore
  app.post(api.chores.toggle.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const result = await storage.toggleChore(id);
      
      // Check badges after points update
      const userState = await storage.getUserState();
      const newBadges = await storage.checkAndAwardBadges(userState.totalEarnedLifetime);
      
      res.json({
        chore: result.chore,
        userState,
        newBadges
      });
    } catch (e) {
      res.status(404).json({ message: (e as Error).message });
    }
  });

  // Reset Daily
  app.post(api.chores.reset.path, async (req, res) => {
    await storage.resetChores();
    res.json({ message: "Chores reset for tomorrow!" });
  });

  // Rewards List
  app.get(api.rewards.list.path, async (req, res) => {
    const rewards = await storage.getRewards();
    res.json(rewards);
  });

  // Buy Reward
  app.post(api.rewards.buy.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const result = await storage.buyReward(id);
      res.json(result);
    } catch (e: any) {
      if (e.message === "Not enough points") {
        res.status(400).json({ message: e.message });
      } else {
        res.status(404).json({ message: e.message });
      }
    }
  });

  // Badges List
  app.get(api.badges.list.path, async (req, res) => {
    const badges = await storage.getBadges();
    res.json(badges);
  });

  // User State
  app.get(api.user.get.path, async (req, res) => {
    const state = await storage.getUserState();
    res.json(state);
  });

  // Purchase History
  app.get(api.user.purchases.path, async (req, res) => {
    const purchases = await storage.getPurchases();
    res.json(purchases);
  });

  return httpServer;
}
