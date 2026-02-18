
import { z } from 'zod';
import { insertChoreSchema, insertRewardSchema, chores, badges, rewards, purchases, userState } from './schema';

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
          newBadges: z.array(z.custom<typeof badges.$inferSelect>()), // Returns any newly earned badges
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
        400: z.object({ message: z.string() }), // Not enough points
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
