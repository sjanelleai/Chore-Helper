import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { EnabledChore, EnabledReward } from "@shared/schema";
import type { ChoreCatalogItem, RewardCatalogItem } from "./use-data";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useKidToken(): string | null {
  const { kidSession } = useAuth();
  return kidSession?.kidToken || null;
}

function useKidChildId(): string | null {
  const { kidSession } = useAuth();
  return kidSession?.childId || null;
}

export function useKidChoreCatalog() {
  const kidToken = useKidToken();
  const { kidSession } = useAuth();
  return useQuery<ChoreCatalogItem[]>({
    queryKey: ["kid_chore_catalog", kidSession?.familyId],
    enabled: !!kidToken,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kid_get_catalog", {
        p_kid_token: kidToken!,
        p_type: "chore",
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to load chores");
      return (result.items || []) as ChoreCatalogItem[];
    },
  });
}

export function useKidRewardCatalog() {
  const kidToken = useKidToken();
  const { kidSession } = useAuth();
  return useQuery<RewardCatalogItem[]>({
    queryKey: ["kid_reward_catalog", kidSession?.familyId],
    enabled: !!kidToken,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kid_get_catalog", {
        p_kid_token: kidToken!,
        p_type: "reward",
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to load rewards");
      return (result.items || []) as RewardCatalogItem[];
    },
  });
}

export function useKidChildPoints() {
  const kidToken = useKidToken();
  const childId = useKidChildId();
  return useQuery({
    queryKey: ["kid_child_points", childId],
    enabled: !!kidToken && !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kid_get_points", {
        p_kid_token: kidToken!,
        p_child_id: childId!,
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to load points");
      return {
        child_id: childId!,
        points: result.points ?? 0,
        lifetime_points: result.lifetime_points ?? 0,
        updated_at: new Date().toISOString(),
      };
    },
  });
}

export function useKidChores() {
  const kidToken = useKidToken();
  const childId = useKidChildId();
  const { data: catalog } = useKidChoreCatalog();

  return useQuery<EnabledChore[]>({
    queryKey: ["kid_chores", childId, catalog?.length],
    enabled: !!kidToken && !!childId && !!catalog && catalog.length > 0,
    queryFn: async () => {
      if (!catalog || !childId) return [];

      const activeChores = catalog.filter(c => c.active);
      const today = localDateKey(new Date());

      const { data, error } = await supabase.rpc("kid_get_chore_status", {
        p_kid_token: kidToken!,
        p_child_id: childId,
        p_date_key: today,
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      const completedIds = new Set<string>(result?.completed_chore_ids || []);

      return activeChores.map(c => ({
        id: c.id,
        title: c.title,
        points: c.points,
        completed: completedIds.has(c.id),
        categoryName: c.category,
      }));
    },
  });
}

export function useKidToggleChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const kidToken = useKidToken();
  const childId = useKidChildId();
  const { data: catalog } = useKidChoreCatalog();

  return useMutation({
    mutationFn: async (choreId: string) => {
      if (!kidToken || !childId) throw new Error("Not signed in");

      const today = localDateKey(new Date());

      const { data, error } = await supabase.rpc("kid_toggle_chore", {
        p_kid_token: kidToken,
        p_child_id: childId,
        p_chore_id: choreId,
        p_date_key: today,
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to toggle chore");

      const chore = catalog?.find(c => c.id === choreId);
      return {
        ok: true,
        completed: result.completed as boolean,
        choreTitle: chore?.title || "Chore",
        chorePoints: chore?.points || 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kid_chores"] });
      queryClient.invalidateQueries({ queryKey: ["kid_child_points"] });
      queryClient.invalidateQueries({ queryKey: ["kid_badges"] });

      if (data.completed) {
        toast({
          title: "Great job!",
          description: `+${data.chorePoints} points earned!`,
          className: "bg-green-500 text-white border-none",
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Oops!", description: err.message, variant: "destructive" });
    },
  });
}

export function useKidRewards() {
  const { data: catalog } = useKidRewardCatalog();

  return useQuery<EnabledReward[]>({
    queryKey: ["kid_rewards", catalog?.length],
    enabled: !!catalog && catalog.length > 0,
    queryFn: async () => {
      if (!catalog) return [];
      return catalog
        .filter(r => r.active)
        .map(r => ({
          id: r.id,
          title: r.title,
          cost: r.cost,
          category: r.category,
        }));
    },
  });
}

export function useKidRedeemReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const kidToken = useKidToken();
  const childId = useKidChildId();
  const { data: catalog } = useKidRewardCatalog();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      if (!kidToken || !childId) throw new Error("Not signed in");

      const { data, error } = await supabase.rpc("kid_redeem_reward", {
        p_kid_token: kidToken,
        p_child_id: childId,
        p_reward_id: rewardId,
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to redeem reward");

      const reward = catalog?.find(r => r.id === rewardId);
      return {
        ok: true,
        redemption_id: result.redemption_id as string,
        rewardTitle: reward?.title || "Reward",
        rewardCost: reward?.cost || 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kid_child_points"] });
      queryClient.invalidateQueries({ queryKey: ["kid_redemptions"] });
      toast({
        title: "Reward Redeemed!",
        description: `You got ${data.rewardTitle}!`,
        className: "bg-secondary text-secondary-foreground border-none font-display",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot redeem", description: err.message, variant: "destructive" });
    },
  });
}

export function useKidBadges() {
  const kidToken = useKidToken();
  const childId = useKidChildId();

  return useQuery({
    queryKey: ["kid_badges", childId],
    enabled: !!kidToken && !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kid_get_badges", {
        p_kid_token: kidToken!,
        p_child_id: childId!,
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to load badges");
      return result.badges || [];
    },
  });
}

export function useKidRedemptions() {
  const kidToken = useKidToken();
  const childId = useKidChildId();

  return useQuery({
    queryKey: ["kid_redemptions", childId],
    enabled: !!kidToken && !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kid_get_redemptions", {
        p_kid_token: kidToken!,
        p_child_id: childId!,
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to load redemptions");
      return (result.redemptions || []).map((r: any) => ({
        id: r.id,
        reward_id: r.reward_id,
        reward_title: r.reward_title || "Unknown",
        cost: r.cost,
        status: r.status,
        purchased_at: r.created_at,
      }));
    },
  });
}
