import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { EnabledChore, EnabledReward } from "@shared/schema";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const BADGE_DEFS = [
  { key: "starter", name: "Starter Badge", threshold: 50, icon: "medal_bronze" },
  { key: "helper2", name: "Helper Level 2", threshold: 150, icon: "medal_silver" },
  { key: "master", name: "Chore Master", threshold: 300, icon: "medal_gold" },
  { key: "star", name: "Super Star", threshold: 500, icon: "star" },
  { key: "champion", name: "Champion", threshold: 1000, icon: "trophy" },
  { key: "legend", name: "Legend", threshold: 2000, icon: "crown" },
];

export interface ChoreCatalogItem {
  id: string;
  family_id: string;
  category: string;
  title: string;
  points: number;
  active: boolean;
  sort_order: number;
}

export interface RewardCatalogItem {
  id: string;
  family_id: string;
  category: string;
  title: string;
  cost: number;
  requires_parent_approval: boolean;
  active: boolean;
  sort_order: number;
}

export function useFamilySettings() {
  const { family } = useAuth();
  return useQuery({
    queryKey: ["family_settings", family?.familyId],
    enabled: !!family?.familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_settings")
        .select("*")
        .eq("family_id", family!.familyId)
        .single();

      if (error || !data) {
        console.warn("[use-data] family_settings not found, attempting to create defaults");
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data: inserted, error: insertErr } = await supabase
          .from("family_settings")
          .insert({
            family_id: family!.familyId,
            primary_parent_email: currentUser?.email || null,
          })
          .select()
          .single();

        if (insertErr || !inserted) {
          console.warn("[use-data] Could not create family_settings, using defaults:", insertErr);
          return {
            family_id: family!.familyId,
            primary_parent_email: currentUser?.email || null,
            secondary_parent_email: null,
            daily_summary_enabled: false,
            daily_summary_time_local: "19:30",
            timezone: "America/Denver",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        return inserted as {
          family_id: string;
          primary_parent_email: string | null;
          secondary_parent_email: string | null;
          daily_summary_enabled: boolean;
          daily_summary_time_local: string | null;
          timezone: string | null;
          approval_mode: string;
          approval_threshold: number;
          created_at: string;
          updated_at: string;
        };
      }

      return data as {
        family_id: string;
        primary_parent_email: string | null;
        secondary_parent_email: string | null;
        daily_summary_enabled: boolean;
        daily_summary_time_local: string | null;
        timezone: string | null;
        approval_mode: string;
        approval_threshold: number;
        created_at: string;
        updated_at: string;
      };
    },
  });
}

export function useChoreCatalog() {
  const { family } = useAuth();
  return useQuery<ChoreCatalogItem[]>({
    queryKey: ["chore_catalog", family?.familyId],
    enabled: !!family?.familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chore_catalog")
        .select("*")
        .eq("family_id", family!.familyId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as ChoreCatalogItem[];
    },
  });
}

export function useRewardCatalog() {
  const { family } = useAuth();
  return useQuery<RewardCatalogItem[]>({
    queryKey: ["reward_catalog", family?.familyId],
    enabled: !!family?.familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_catalog")
        .select("*")
        .eq("family_id", family!.familyId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as RewardCatalogItem[];
    },
  });
}

export function useChildPoints() {
  const { activeChildId } = useAuth();
  return useQuery({
    queryKey: ["child_points", activeChildId],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_ledger")
        .select("points_delta")
        .eq("child_id", activeChildId!);

      if (error) throw error;

      const rows = data || [];
      let points = 0;
      let lifetime_points = 0;
      for (const row of rows) {
        points += row.points_delta;
        if (row.points_delta > 0) {
          lifetime_points += row.points_delta;
        }
      }

      return { child_id: activeChildId!, points, lifetime_points, updated_at: new Date().toISOString() };
    },
  });
}

export function useChores() {
  const { activeChildId, family } = useAuth();
  const { data: catalog } = useChoreCatalog();
  const today = localDateKey(new Date());

  return useQuery<EnabledChore[]>({
    queryKey: ["chores", family?.familyId, activeChildId, today],
    enabled: !!activeChildId && !!family?.familyId && !!catalog && catalog.length > 0,
    queryFn: async () => {
      if (!catalog || !activeChildId) return [];

      const activeChores = catalog.filter(c => c.active);

      const { data: dailyRows, error: dailyErr } = await supabase
        .from("daily_status_v2")
        .select("chore_id, completed, status")
        .eq("child_id", activeChildId)
        .eq("date_key", today);

      if (dailyErr) {
        console.error("daily_status_v2 select failed", dailyErr);
      }

      const safeRows = dailyRows ?? [];
      const statusMap = new Map<string, string>();
      for (const row of safeRows) {
        statusMap.set(row.chore_id, row.status ?? "approved");
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

export function useToggleChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId, family } = useAuth();
  const { data: catalog } = useChoreCatalog();

  return useMutation({
    mutationFn: async (choreId: string) => {
      if (!activeChildId) throw new Error("No child selected");

      const today = localDateKey(new Date());

      const { data, error } = await supabase.rpc("toggle_chore", {
        p_child_id: activeChildId,
        p_chore_id: choreId,
        p_date_key: today,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const chore = catalog?.find(c => c.id === choreId);
      return {
        ok: data.ok as boolean,
        status: (data.status ?? "approved") as string,
        choreTitle: chore?.title || "Chore",
        chorePoints: chore?.points || 0,
      };
    },
    onSuccess: (data, choreId) => {
      const today = localDateKey(new Date());
      const choresKey = ["chores", family?.familyId, activeChildId, today];

      queryClient.setQueryData<EnabledChore[]>(choresKey, (old) => {
        if (!old) return old;
        return old.map(c =>
          c.id === choreId
            ? { ...c, status: data.status as EnabledChore["status"], completed: data.status === "approved" }
            : c
        );
      });

      queryClient.invalidateQueries({ queryKey: choresKey });
      queryClient.invalidateQueries({ queryKey: ["child_points", activeChildId] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["family_summary"] });
      queryClient.invalidateQueries({ queryKey: ["pending_approvals"] });

      if (data.status === "approved") {
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

export function useResetChores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!activeChildId) throw new Error("No child selected");
      const today = localDateKey(new Date());

      const { error } = await supabase
        .from("daily_status_v2")
        .delete()
        .eq("child_id", activeChildId)
        .eq("date_key", today);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      toast({ title: "Ready for a new day!", description: "All chores have been reset." });
    },
  });
}

export interface PendingApproval {
  child_id: string;
  child_name: string;
  chore_id: string;
  chore_title: string;
  points: number;
  date_key: string;
  created_at: string;
}

export function usePendingApprovals() {
  const { family } = useAuth();

  return useQuery<PendingApproval[]>({
    queryKey: ["pending_approvals", family?.familyId],
    enabled: !!family?.familyId,
    queryFn: async () => {
      if (!family?.familyId) return [];

      const today = localDateKey(new Date());
      const { data, error } = await supabase.rpc("get_pending_approvals", {
        p_family_id: family.familyId,
        p_date_key: today,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.pending || []) as PendingApproval[];
    },
    refetchInterval: 15000,
  });
}

export function useApproveChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ childId, choreId, dateKey }: { childId: string; choreId: string; dateKey: string }) => {
      const { data, error } = await supabase.rpc("parent_approve_chore", {
        p_child_id: childId,
        p_chore_id: choreId,
        p_date_key: dateKey,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: ptsData } = await supabase
        .from("points_ledger")
        .select("points_delta")
        .eq("child_id", childId);

      let lifetimeTotal = 0;
      for (const row of (ptsData || [])) {
        if (row.points_delta > 0) lifetimeTotal += row.points_delta;
      }

      const newBadges = await checkAndAwardBadges(childId, lifetimeTotal);
      return { newBadges };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["family_summary"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });

      if (data.newBadges?.length > 0) {
        data.newBadges.forEach((badge) => {
          toast({
            title: "Badge Unlocked!",
            description: `${badge.name} badge earned!`,
            className: "bg-accent text-accent-foreground border-none",
          });
        });
      }
      toast({
        title: "Approved!",
        description: "Points have been awarded.",
        className: "bg-green-500 text-white border-none",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useRejectChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ childId, choreId, dateKey }: { childId: string; choreId: string; dateKey: string }) => {
      const { data, error } = await supabase.rpc("parent_reject_chore", {
        p_child_id: childId,
        p_chore_id: choreId,
        p_date_key: dateKey,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["family_summary"] });
      toast({
        title: "Rejected",
        description: "Chore has been cleared.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useRewards() {
  const { data: catalog } = useRewardCatalog();

  return useQuery<EnabledReward[]>({
    queryKey: ["rewards", catalog?.length],
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

export function useRedeemReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId } = useAuth();
  const { data: catalog } = useRewardCatalog();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      if (!activeChildId) throw new Error("No child selected");

      const { data, error } = await supabase.rpc("redeem_reward", {
        p_child_id: activeChildId,
        p_reward_id: rewardId,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reward = catalog?.find(r => r.id === rewardId);
      return {
        ok: data.ok as boolean,
        redemption_id: data.redemption_id as string,
        rewardTitle: reward?.title || "Reward",
        rewardCost: reward?.cost || 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["family_summary"] });
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

export function useRedemptions() {
  const { activeChildId, family } = useAuth();
  return useQuery({
    queryKey: ["redemptions", activeChildId],
    enabled: !!activeChildId && !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_redemptions")
        .select("id, reward_id, cost, status, created_at, reward_catalog(title)")
        .eq("child_id", activeChildId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        reward_id: r.reward_id,
        reward_title: r.reward_catalog?.title || "Unknown",
        cost: r.cost,
        status: r.status,
        purchased_at: r.created_at,
      }));
    },
  });
}

export function usePurchases() {
  return useRedemptions();
}

export function useUserState() {
  const { data: pts } = useChildPoints();
  const { data: settings } = useFamilySettings();

  const combined = pts && settings ? {
    totalPoints: pts.points,
    totalEarnedLifetime: pts.lifetime_points,
    parentEmail: settings.primary_parent_email,
    secondaryParentEmail: settings.secondary_parent_email,
    dailySummaryEnabled: settings.daily_summary_enabled ?? false,
    dailySummaryTimeLocal: settings.daily_summary_time_local ?? "19:30",
    dailySummaryTimezone: settings.timezone ?? "America/Denver",
  } : undefined;

  return { data: combined, isLoading: !pts || !settings };
}

export function useConfig() {
  const { data: chores } = useChoreCatalog();
  const { data: rewards } = useRewardCatalog();

  const mapped = chores && rewards ? {
    enabledChores: Object.fromEntries(chores.map(c => [c.id, c.active])),
    enabledRewards: Object.fromEntries(rewards.map(r => [r.id, r.active])),
    pointsByChoreId: Object.fromEntries(chores.map(c => [c.id, c.points])),
    costByRewardId: Object.fromEntries(rewards.map(r => [r.id, r.cost])),
    choreCatalog: chores,
    rewardCatalog: rewards,
  } : undefined;

  return { data: mapped, isLoading: !chores || !rewards };
}

export function useUpdateChoreConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { enabledChores: Record<string, boolean>; pointsByChoreId: Record<string, number> }) => {
      const updates = Object.entries(data.enabledChores).map(([id, active]) => {
        const points = data.pointsByChoreId[id];
        return supabase
          .from("chore_catalog")
          .update({ active, ...(points !== undefined ? { points } : {}) })
          .eq("id", id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error!.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chore_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      toast({ title: "Chore settings saved!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateRewardConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { enabledRewards: Record<string, boolean>; costByRewardId: Record<string, number> }) => {
      const updates = Object.entries(data.enabledRewards).map(([id, active]) => {
        const cost = data.costByRewardId[id];
        return supabase
          .from("reward_catalog")
          .update({ active, ...(cost !== undefined ? { cost } : {}) })
          .eq("id", id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error!.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: "Reward settings saved!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { family } = useAuth();

  return useMutation({
    mutationFn: async (data: { title: string; category: string; cost: number; active?: boolean }) => {
      const { error } = await supabase
        .from("reward_catalog")
        .insert({
          family_id: family!.familyId,
          title: data.title,
          category: data.category,
          cost: data.cost,
          active: data.active ?? true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: "Reward added!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; title?: string; category?: string; cost?: number; active?: boolean }) => {
      const { id, ...updates } = data;
      const { error } = await supabase
        .from("reward_catalog")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: "Reward updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useArchiveReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("reward_catalog")
        .update({ active: data.active })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["reward_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: vars.active ? "Reward restored!" : "Reward archived!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { family } = useAuth();

  return useMutation({
    mutationFn: async (settings: { parentEmail?: string | null; secondaryParentEmail?: string | null; dailySummaryEnabled?: boolean; dailySummaryTimeLocal?: string; dailySummaryTimezone?: string; approvalMode?: string; approvalThreshold?: number }) => {
      if (!family) throw new Error("No family");

      const updateData: any = {};
      if (settings.parentEmail !== undefined) updateData.primary_parent_email = settings.parentEmail;
      if (settings.secondaryParentEmail !== undefined) updateData.secondary_parent_email = settings.secondaryParentEmail;
      if (settings.dailySummaryEnabled !== undefined) updateData.daily_summary_enabled = settings.dailySummaryEnabled;
      if (settings.dailySummaryTimeLocal !== undefined) updateData.daily_summary_time_local = settings.dailySummaryTimeLocal;
      if (settings.dailySummaryTimezone !== undefined) updateData.timezone = settings.dailySummaryTimezone;
      if (settings.approvalMode !== undefined) updateData.approval_mode = settings.approvalMode;
      if (settings.approvalThreshold !== undefined) updateData.approval_threshold = settings.approvalThreshold;

      const { error } = await supabase
        .from("family_settings")
        .update(updateData)
        .eq("family_id", family.familyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_settings"] });
      toast({ title: "Settings saved!", description: "Your preferences have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useBadges() {
  const { activeChildId } = useAuth();
  const { data: pts } = useChildPoints();

  return useQuery({
    queryKey: ["badges", activeChildId, pts?.lifetime_points],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data: earnedBadges } = await supabase
        .from("child_badges")
        .select("badge_key")
        .eq("child_id", activeChildId!);

      const earnedKeys = new Set((earnedBadges || []).map((b: any) => b.badge_key));
      const lifetime = pts?.lifetime_points || 0;

      return BADGE_DEFS.map(b => ({
        id: b.key,
        name: b.name,
        icon: b.icon,
        threshold: b.threshold,
        earned: earnedKeys.has(b.key) || lifetime >= b.threshold,
        description: `Earn ${b.threshold} lifetime points`,
      }));
    },
  });
}

async function checkAndAwardBadges(childId: string, lifetimePoints: number) {
  const { data: existing } = await supabase
    .from("child_badges")
    .select("badge_key")
    .eq("child_id", childId);

  const earnedKeys = new Set((existing || []).map((b: any) => b.badge_key));
  const newBadges = BADGE_DEFS.filter(b => !earnedKeys.has(b.key) && lifetimePoints >= b.threshold);

  for (const badge of newBadges) {
    await supabase.from("child_badges").insert({
      child_id: childId,
      badge_key: badge.key,
      badge_name: badge.name,
      badge_icon: badge.icon,
      threshold: badge.threshold,
    });
  }

  return newBadges;
}

export function useAwardBonus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId } = useAuth();

  return useMutation({
    mutationFn: async (data: { reason: string; points: number; note?: string }) => {
      if (!activeChildId) throw new Error("No child selected");

      const { data: result, error } = await supabase.rpc("grant_bonus", {
        p_child_id: activeChildId,
        p_points: data.points,
        p_note: data.note || data.reason,
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const { data: ptsData } = await supabase
        .from("points_ledger")
        .select("points_delta")
        .eq("child_id", activeChildId);

      let lifetimeTotal = 0;
      for (const row of (ptsData || [])) {
        if (row.points_delta > 0) lifetimeTotal += row.points_delta;
      }

      const newBadges = await checkAndAwardBadges(activeChildId, lifetimeTotal);

      return { pointsDelta: data.points, newBadges, newTotal: lifetimeTotal };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      queryClient.invalidateQueries({ queryKey: ["family_summary"] });

      if (data.newBadges?.length > 0) {
        data.newBadges.forEach((badge) => {
          toast({
            title: "Badge Unlocked!",
            description: `"${badge.name}" badge earned!`,
            className: "bg-accent text-accent-foreground border-none",
          });
        });
      }
      toast({ title: "Bonus awarded!", description: `+${data.pointsDelta} points!` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeductPoints() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId } = useAuth();

  return useMutation({
    mutationFn: async (data: { reason: string; points: number; note?: string }) => {
      if (!activeChildId) throw new Error("No child selected");

      const { data: result, error } = await supabase.rpc("deduct_points", {
        p_child_id: activeChildId,
        p_points: data.points,
        p_reason: data.note || data.reason,
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return { pointsDelta: -data.points };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["child_points", activeChildId] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["family_summary"] });
      toast({
        title: "Points deducted",
        description: `${data.pointsDelta} points applied.`,
        variant: "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useLedger() {
  const { activeChildId } = useAuth();
  return useQuery({
    queryKey: ["ledger", activeChildId],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_ledger")
        .select("*")
        .eq("child_id", activeChildId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export interface ChildDailySummary {
  childName: string;
  completedChores: string[];
  missedChores: string[];
  bonuses: { reason: string; points: number; note: string | null }[];
  redemptions: { name: string; cost: number }[];
  pointsEarnedToday: number;
  currentBalance: number;
}

export interface FamilySummary {
  date: string;
  familyName: string;
  children: ChildDailySummary[];
  totalPointsEarned: number;
  totalChoresCompleted: number;
  totalChoresMissed: number;
}

export function useFamilySummary(date?: string) {
  const { family } = useAuth();

  return useQuery<FamilySummary | null>({
    queryKey: ["family_summary", family?.familyId, date],
    enabled: !!family?.familyId,
    queryFn: async () => {
      if (!family?.familyId) return null;

      const today = date || localDateKey(new Date());

      const { data: rows, error } = await supabase.rpc("family_daily_summary", {
        p_family_id: family.familyId,
        p_date_key: today,
      });

      if (error) throw error;

      const childSummaries: ChildDailySummary[] = (rows || []).map((row: any) => ({
        childName: row.child_name,
        completedChores: row.completed_chores || [],
        missedChores: row.missed_chores || [],
        bonuses: (row.bonuses || []).map((b: any) => ({
          reason: b.reason || "Bonus",
          points: b.points,
          note: b.reason || null,
        })),
        redemptions: (row.redemptions || []).map((r: any) => ({
          name: r.name || "Reward",
          cost: r.cost,
        })),
        pointsEarnedToday: row.points_today || 0,
        currentBalance: row.current_balance || 0,
      }));

      return {
        date: today,
        familyName: `${family.parentDisplayName}'s Family`,
        children: childSummaries,
        totalPointsEarned: childSummaries.reduce((s, c) => s + c.pointsEarnedToday, 0),
        totalChoresCompleted: childSummaries.reduce((s, c) => s + c.completedChores.length, 0),
        totalChoresMissed: childSummaries.reduce((s, c) => s + c.missedChores.length, 0),
      };
    },
  });
}

export function useDailySummary(date?: string) {
  return useFamilySummary(date);
}

export function useSendSummaryEmail() {
  const { toast } = useToast();
  const { data: settings } = useFamilySettings();

  return useMutation({
    mutationFn: async (summary: FamilySummary) => {
      const emails: string[] = [];
      if (settings?.primary_parent_email) emails.push(settings.primary_parent_email);
      if (settings?.secondary_parent_email) emails.push(settings.secondary_parent_email);

      if (emails.length === 0) {
        throw new Error("No parent emails configured. Please set at least one email in Settings.");
      }

      const res = await fetch("/api/summary/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, summary }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent!", description: "Daily summary has been emailed to all parent emails." });
    },
    onError: (err: Error) => {
      toast({ title: "Error sending email", description: err.message, variant: "destructive" });
    },
  });
}
