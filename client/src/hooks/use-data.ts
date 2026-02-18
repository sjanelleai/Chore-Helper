import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Chore, Badge, Reward, Purchase, UserState } from "@shared/schema";

// --- Chores ---

export function useChores() {
  return useQuery({
    queryKey: [api.chores.list.path],
    queryFn: async () => {
      const res = await fetch(api.chores.list.path);
      if (!res.ok) throw new Error("Failed to fetch chores");
      return api.chores.list.responses[200].parse(await res.json());
    },
  });
}

export function useToggleChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.chores.toggle.path, { id });
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle chore");
      return api.chores.toggle.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Invalidate chores to show new status
      queryClient.invalidateQueries({ queryKey: [api.chores.list.path] });
      // Update user state immediately
      queryClient.setQueryData([api.user.get.path], data.userState);
      
      // Check for newly earned badges
      if (data.newBadges && data.newBadges.length > 0) {
        data.newBadges.forEach(badge => {
          toast({
            title: "🎉 Badge Unlocked!",
            description: `You earned the "${badge.name}" badge!`,
            variant: "default",
            className: "bg-accent text-accent-foreground border-none font-display text-lg",
          });
        });
        queryClient.invalidateQueries({ queryKey: [api.badges.list.path] });
      }

      // Feedback toast for chore
      if (data.chore.completed) {
        toast({
          title: "Great job!",
          description: `+${data.chore.points} points added!`,
          className: "bg-green-500 text-white border-none",
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Oops!",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useResetChores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.chores.reset.path, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset chores");
      return api.chores.reset.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.chores.list.path] });
      toast({
        title: "Ready for a new day!",
        description: "All chores have been reset.",
      });
    },
  });
}

// --- Rewards & Purchases ---

export function useRewards() {
  return useQuery({
    queryKey: [api.rewards.list.path],
    queryFn: async () => {
      const res = await fetch(api.rewards.list.path);
      if (!res.ok) throw new Error("Failed to fetch rewards");
      return api.rewards.list.responses[200].parse(await res.json());
    },
  });
}

export function useBuyReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.rewards.buy.path, { id });
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to buy reward");
      }
      return api.rewards.buy.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.user.get.path], data.userState);
      queryClient.invalidateQueries({ queryKey: [api.user.purchases.path] });
      
      toast({
        title: "Reward Purchased!",
        description: `You bought ${data.purchase.rewardName}!`,
        className: "bg-secondary text-secondary-foreground border-none font-display",
      });
    },
    onError: (err) => {
      toast({
        title: "Cannot purchase",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function usePurchases() {
  return useQuery({
    queryKey: [api.user.purchases.path],
    queryFn: async () => {
      const res = await fetch(api.user.purchases.path);
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return api.user.purchases.responses[200].parse(await res.json());
    },
  });
}

// --- User State & Badges ---

export function useUserState() {
  return useQuery({
    queryKey: [api.user.get.path],
    queryFn: async () => {
      const res = await fetch(api.user.get.path);
      if (!res.ok) throw new Error("Failed to fetch user state");
      return api.user.get.responses[200].parse(await res.json());
    },
  });
}

export function useBadges() {
  return useQuery({
    queryKey: [api.badges.list.path],
    queryFn: async () => {
      const res = await fetch(api.badges.list.path);
      if (!res.ok) throw new Error("Failed to fetch badges");
      return api.badges.list.responses[200].parse(await res.json());
    },
  });
}
