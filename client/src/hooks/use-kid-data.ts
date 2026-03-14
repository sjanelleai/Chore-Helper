import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { EnabledChore, EnabledReward } from "@shared/schema";
import type { ChoreCatalogItem, RewardCatalogItem } from "./use-data";

function parseRpcResponse<T = { ok?: boolean; error?: string }>(data: unknown): T {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      throw new Error("Failed to parse server response");
    }
  }
  return data as T;
}

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
      });
      if (error) throw error;
      const result = parseRpcResponse<{ chores?: unknown[] }>(data);
      return (result?.chores || []) as ChoreCatalogItem[];
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
      });
      if (error) throw error;
      const result = parseRpcResponse<{ rewards?: unknown[] }>(data);
      return (result?.rewards || []) as RewardCatalogItem[];
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
      const result = parseRpcResponse<{ ok?: boolean; error?: string; points?: number; lifetime_points?: number }>(data);
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
  const { kidSession } = useAuth();
  const { data: catalog } = useKidChoreCatalog();
  const today = localDateKey(new Date());

  return useQuery<EnabledChore[]>({
    queryKey: ["kid_chores", kidSession?.familyId, childId, today],
    enabled: !!kidToken && !!childId && !!catalog && catalog.length > 0,
    queryFn: async () => {
      if (!catalog || !childId) return [];

      const activeChores = catalog.filter(c => c.active);

      const { data, error } = await supabase.rpc("kid_get_chore_status", {
        p_kid_token: kidToken!,
        p_child_id: childId,
        p_date_key: today,
      });

      if (error) throw error;
      const result = parseRpcResponse<{ statuses?: Array<{ chore_id: string; status: string }> }>(data);
      const statuses = result?.statuses || [];
      const statusMap = new Map<string, string>();
      for (const s of statuses) {
        statusMap.set(s.chore_id, s.status ?? "approved");
      }

      return activeChores.map(c => {
        const rowStatus = statusMap.get(c.id);
        return {
          id: c.id,
          title: c.title,
          points: c.points,
          completed: rowStatus === "approved",
          status: (rowStatus || "unchecked") as "approved" | "pending" | "unchecked",
          categoryName: c.category,
        };
      });
    },
  });
}

export function useKidToggleChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const kidToken = useKidToken();
  const childId = useKidChildId();
  const { kidSession } = useAuth();
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
      const result = parseRpcResponse<{ ok?: boolean; error?: string; status?: string }>(data);
      if (!result?.ok) throw new Error(result?.error || "Failed to toggle chore");

      const chore = catalog?.find(c => c.id === choreId);
      return {
        ok: true,
        status: (result.status || "approved") as string,
        choreTitle: chore?.title || "Chore",
        chorePoints: chore?.points || 0,
      };
    },
    onSuccess: (data, choreId) => {
      const today = localDateKey(new Date());
      const choresKey = ["kid_chores", kidSession?.familyId, childId, today];

      queryClient.setQueryData<EnabledChore[]>(choresKey, (old) => {
        if (!old) return old;
        return old.map(c =>
          c.id === choreId
            ? { ...c, status: data.status as EnabledChore["status"], completed: data.status === "approved" }
            : c
        );
      });

      queryClient.invalidateQueries({ queryKey: choresKey });
      queryClient.invalidateQueries({ queryKey: ["kid_child_points", childId] });
      queryClient.invalidateQueries({ queryKey: ["kid_badges"] });

      if (data.status === "approved") {
        toast({
          title: "Great job!",
          description: `+${data.chorePoints} points earned!`,
          className: "bg-green-500 text-white border-none",
        });
      } else if (data.status === "pending") {
        toast({
          title: "Submitted!",
          description: `Waiting for a parent to approve ${data.choreTitle}`,
          className: "bg-yellow-500 text-white border-none",
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
      const result = parseRpcResponse<{ ok?: boolean; error?: string; redemption_id?: string }>(data);
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
      const result = parseRpcResponse<{ ok?: boolean; error?: string; badges?: unknown[] }>(data);
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
      const result = parseRpcResponse<{
        ok?: boolean;
        error?: string;
        redemptions?: Array<{ id: string; reward_id: string; reward_title?: string; cost: number; status: string; created_at: string }>;
      }>(data);
      if (!result?.ok) throw new Error(result?.error || "Failed to load redemptions");
      return (result.redemptions || []).map((r) => ({
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
