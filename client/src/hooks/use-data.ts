import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Chore, Badge, Reward, Purchase, UserState, LedgerEvent } from "@shared/schema";

// --- Chores ---

export function useChores() {
  return useQuery<Chore[]>({
    queryKey: [api.chores.list.path],
    queryFn: async () => {
      const res = await fetch(api.chores.list.path);
      if (!res.ok) throw new Error("Failed to fetch chores");
      return res.json();
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
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [api.chores.list.path] });
      queryClient.setQueryData([api.user.get.path], data.userState);

      if (data.newBadges && data.newBadges.length > 0) {
        data.newBadges.forEach((badge: Badge) => {
          toast({
            title: "Badge Unlocked!",
            description: `You earned the "${badge.name}" badge!`,
            className: "bg-accent text-accent-foreground border-none font-display text-lg",
          });
        });
        queryClient.invalidateQueries({ queryKey: [api.badges.list.path] });
      }

      if (data.chore.completed) {
        toast({
          title: "Great job!",
          description: `+${data.chore.points} points added!`,
          className: "bg-green-500 text-white border-none",
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Oops!", description: err.message, variant: "destructive" });
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
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.chores.list.path] });
      toast({ title: "Ready for a new day!", description: "All chores have been reset." });
    },
  });
}

// --- Rewards & Purchases ---

export function useRewards() {
  return useQuery<Reward[]>({
    queryKey: [api.rewards.list.path],
    queryFn: async () => {
      const res = await fetch(api.rewards.list.path);
      if (!res.ok) throw new Error("Failed to fetch rewards");
      return res.json();
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
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData([api.user.get.path], data.userState);
      queryClient.invalidateQueries({ queryKey: [api.user.purchases.path] });
      toast({
        title: "Reward Purchased!",
        description: `You bought ${data.purchase.rewardName}!`,
        className: "bg-secondary text-secondary-foreground border-none font-display",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot purchase", description: err.message, variant: "destructive" });
    },
  });
}

export function useToggleApproval() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      const url = buildUrl(api.rewards.toggleApproval.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (!res.ok) throw new Error("Failed to update approval");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.rewards.list.path] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function usePurchases() {
  return useQuery<Purchase[]>({
    queryKey: [api.user.purchases.path],
    queryFn: async () => {
      const res = await fetch(api.user.purchases.path);
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return res.json();
    },
  });
}

// --- User State & Settings ---

export function useUserState() {
  return useQuery<UserState>({
    queryKey: [api.user.get.path],
    queryFn: async () => {
      const res = await fetch(api.user.get.path);
      if (!res.ok) throw new Error("Failed to fetch user state");
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch(api.user.updateSettings.path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: (data: UserState) => {
      queryClient.setQueryData([api.user.get.path], data);
      toast({ title: "Settings saved!", description: "Your preferences have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// --- Badges ---

export function useBadges() {
  return useQuery<Badge[]>({
    queryKey: [api.badges.list.path],
    queryFn: async () => {
      const res = await fetch(api.badges.list.path);
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    },
  });
}

// --- Bonus ---

export function useAwardBonus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { reason: string; points: number; note?: string }) => {
      const res = await fetch(api.bonus.award.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to award bonus");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData([api.user.get.path], data.userState);
      queryClient.invalidateQueries({ queryKey: [api.ledger.list.path] });
      if (data.newBadges?.length > 0) {
        queryClient.invalidateQueries({ queryKey: [api.badges.list.path] });
        data.newBadges.forEach((badge: Badge) => {
          toast({
            title: "Badge Unlocked!",
            description: `"${badge.name}" badge earned!`,
            className: "bg-accent text-accent-foreground border-none",
          });
        });
      }
      toast({ title: "Bonus awarded!", description: `+${data.event.pointsDelta} points!` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// --- Ledger ---

export function useLedger() {
  return useQuery<LedgerEvent[]>({
    queryKey: [api.ledger.list.path],
    queryFn: async () => {
      const res = await fetch(api.ledger.list.path);
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
  });
}

// --- Summary ---

export function useDailySummary(date?: string) {
  const url = date ? `${api.summary.daily.path}?date=${date}` : api.summary.daily.path;
  return useQuery({
    queryKey: [api.summary.daily.path, date],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });
}

export function useSendSummaryEmail() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.summary.sendEmail.path, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent!", description: "Daily summary has been emailed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error sending email", description: err.message, variant: "destructive" });
    },
  });
}
