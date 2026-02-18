import { z } from 'zod';

export const api = {
  chores: {
    list: {
      method: 'GET' as const,
      path: '/api/chores' as const,
    },
    toggle: {
      method: 'POST' as const,
      path: '/api/chores/:choreId/toggle' as const,
    },
    reset: {
      method: 'POST' as const,
      path: '/api/chores/reset' as const,
    },
  },
  rewards: {
    list: {
      method: 'GET' as const,
      path: '/api/rewards' as const,
    },
    redeem: {
      method: 'POST' as const,
      path: '/api/rewards/:rewardId/redeem' as const,
    },
  },
  badges: {
    list: {
      method: 'GET' as const,
      path: '/api/badges' as const,
    },
  },
  user: {
    get: {
      method: 'GET' as const,
      path: '/api/user/state' as const,
    },
    purchases: {
      method: 'GET' as const,
      path: '/api/user/purchases' as const,
    },
    updateSettings: {
      method: 'PUT' as const,
      path: '/api/user/settings' as const,
      input: z.object({
        parentEmail: z.string().email().nullable().optional(),
        allowanceEnabled: z.boolean().optional(),
        pointsPerDollar: z.number().min(50).max(5000).optional(),
      }),
    },
  },
  config: {
    get: {
      method: 'GET' as const,
      path: '/api/config' as const,
    },
    updateChores: {
      method: 'PUT' as const,
      path: '/api/config/chores' as const,
      input: z.object({
        enabledChores: z.record(z.boolean()),
        pointsByChoreId: z.record(z.number()),
      }),
    },
    updateRewards: {
      method: 'PUT' as const,
      path: '/api/config/rewards' as const,
      input: z.object({
        enabledRewards: z.record(z.boolean()),
        costByRewardId: z.record(z.number()),
      }),
    },
  },
  bonus: {
    award: {
      method: 'POST' as const,
      path: '/api/bonus' as const,
      input: z.object({
        reason: z.string(),
        points: z.number().min(1).max(5000),
        note: z.string().optional(),
      }),
    },
  },
  ledger: {
    list: {
      method: 'GET' as const,
      path: '/api/ledger' as const,
    },
  },
  summary: {
    daily: {
      method: 'GET' as const,
      path: '/api/summary/daily' as const,
    },
    sendEmail: {
      method: 'POST' as const,
      path: '/api/summary/send' as const,
    },
  },
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
