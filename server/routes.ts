import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { sendFamilySummaryEmail, type FamilySummaryData } from "./email";

const familySummarySchema = z.object({
  emails: z.array(z.string().email()).min(1, "At least one email is required"),
  summary: z.object({
    date: z.string(),
    familyName: z.string(),
    children: z.array(z.object({
      childName: z.string(),
      completedChores: z.array(z.string()),
      missedChores: z.array(z.string()),
      bonuses: z.array(z.object({
        reason: z.string(),
        points: z.number(),
        note: z.string().nullable(),
      })),
      redemptions: z.array(z.object({
        name: z.string(),
        cost: z.number(),
      })),
      pointsEarnedToday: z.number(),
      currentBalance: z.number(),
    })),
    totalPointsEarned: z.number(),
    totalChoresCompleted: z.number(),
    totalChoresMissed: z.number(),
  }),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  app.post("/api/summary/send", async (req, res) => {
    try {
      const parsed = familySummarySchema.parse(req.body);
      await sendFamilySummaryEmail(parsed.emails, parsed.summary as FamilySummaryData);
      res.json({ message: `Summary email sent to ${parsed.emails.length} recipient(s)!` });
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0].message });
      }
      console.error("Email send error:", e);
      res.status(500).json({ message: e.message || "Failed to send email" });
    }
  });

  return httpServer;
}
