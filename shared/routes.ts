
import { z } from 'zod';
import { chores, badges, rewards, purchases, userState, ledgerEvents } from './schema';

export const api = {
  chores: {
    list: {
      method: 'GET' as const,
      path: '/api/chores' as const,
      responses: {
        200: z.array(z.custom<typeof chores.$inferSelect>()),
      },
    },
    toggle: {
      method: 'POST' as const,
      path: '/api/chores/:id/toggle' as const,
      responses: {
        200: z.object({
          chore: z.custom<typeof chores.$inferSelect>(),
          userState: z.custom<typeof userState.$inferSelect>(),
          newBadges: z.array(z.custom<typeof badges.$inferSelect>()),
        }),
        404: z.object({ message: z.string() }),
      },
    },
    reset: {
      method: 'POST' as const,
      path: '/api/chores/reset' as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  rewards: {
    list: {
      method: 'GET' as const,
      path: '/api/rewards' as const,
      responses: {
        200: z.array(z.custom<typeof rewards.$inferSelect>()),
      },
    },
    buy: {
      method: 'POST' as const,
      path: '/api/rewards/:id/buy' as const,
      responses: {
        200: z.object({
          purchase: z.custom<typeof purchases.$inferSelect>(),
          userState: z.custom<typeof userState.$inferSelect>(),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    toggleApproval: {
      method: 'POST' as const,
      path: '/api/rewards/:id/approve' as const,
      input: z.object({ approved: z.boolean() }),
      responses: {
        200: z.custom<typeof rewards.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  badges: {
    list: {
      method: 'GET' as const,
      path: '/api/badges' as const,
      responses: {
        200: z.array(z.custom<typeof badges.$inferSelect>()),
      },
    },
  },
  user: {
    get: {
      method: 'GET' as const,
      path: '/api/user/state' as const,
      responses: {
        200: z.custom<typeof userState.$inferSelect>(),
      },
    },
    purchases: {
      method: 'GET' as const,
      path: '/api/user/purchases' as const,
      responses: {
        200: z.array(z.custom<typeof purchases.$inferSelect>()),
      },
    },
    updateSettings: {
      method: 'PUT' as const,
      path: '/api/user/settings' as const,
      input: z.object({
        parentEmail: z.string().email().nullable().optional(),
        timezone: z.string().optional(),
        dailySummaryTime: z.string().optional(),
        allowanceEnabled: z.boolean().optional(),
        pointsPerDollar: z.number().min(1).optional(),
      }),
      responses: {
        200: z.custom<typeof userState.$inferSelect>(),
      },
    },
  },
  bonus: {
    award: {
      method: 'POST' as const,
      path: '/api/bonus' as const,
      input: z.object({
        reason: z.string(),
        points: z.number().min(1).max(300),
        note: z.string().optional(),
      }),
      responses: {
        200: z.object({
          event: z.custom<typeof ledgerEvents.$inferSelect>(),
          userState: z.custom<typeof userState.$inferSelect>(),
          newBadges: z.array(z.custom<typeof badges.$inferSelect>()),
        }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  ledger: {
    list: {
      method: 'GET' as const,
      path: '/api/ledger' as const,
      responses: {
        200: z.array(z.custom<typeof ledgerEvents.$inferSelect>()),
      },
    },
  },
  summary: {
    daily: {
      method: 'GET' as const,
      path: '/api/summary/daily' as const,
      responses: {
        200: z.object({
          date: z.string(),
          completedChores: z.array(z.string()),
          missedChores: z.array(z.string()),
          bonuses: z.array(z.object({ reason: z.string(), points: z.number(), note: z.string().nullable() })),
          redemptions: z.array(z.object({ name: z.string(), cost: z.number() })),
          pointsEarnedToday: z.number(),
          currentBalance: z.number(),
        }),
      },
    },
    sendEmail: {
      method: 'POST' as const,
      path: '/api/summary/send' as const,
      responses: {
        200: z.object({ message: z.string() }),
        400: z.object({ message: z.string() }),
      },
    },
  },
};

export const errorSchemas = {
  notFound: z.object({ message: z.string() }),
  badRequest: z.object({ message: z.string() }),
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
