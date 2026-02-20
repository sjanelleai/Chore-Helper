import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  CATALOG, STARTER_CHORES, STARTER_REWARDS,
  flattenCatalog, findCategoryName, clampNumber, localDateKey,
} from "@shared/catalog";
import type { EnabledChore, EnabledReward } from "@shared/schema";

const BADGE_DEFS = [
  { key: "starter", name: "Starter Badge", threshold: 50, icon: "medal_bronze" },
  { key: "helper2", name: "Helper Level 2", threshold: 150, icon: "medal_silver" },
  { key: "master", name: "Chore Master", threshold: 300, icon: "medal_gold" },
  { key: "star", name: "Super Star", threshold: 500, icon: "star" },
  { key: "champion", name: "Champion", threshold: 1000, icon: "trophy" },
  { key: "legend", name: "Legend", threshold: 2000, icon: "crown" },
];

// --- Family Settings (from family_settings table) ---

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
        return inserted as any;
      }

      return data as {
        family_id: string;
        primary_parent_email: string | null;
        secondary_parent_email: string | null;
        daily_summary_enabled: boolean;
        daily_summary_time_local: string | null;
        timezone: string | null;
        created_at: string;
        updated_at: string;
      };
    },
  });
}

// --- Catalog Config (frontend constants for now — Phase 2 will persist) ---

function getDefaultCatalogConfig() {
  const enabledChores: Record<string, boolean> = {};
  const enabledRewards: Record<string, boolean> = {};
  const pointsByChoreId: Record<string, number> = {};
  const costByRewardId: Record<string, number> = {};

  STARTER_CHORES.forEach(id => { enabledChores[id] = true; });
  STARTER_REWARDS.forEach(id => { enabledRewards[id] = true; });

  flattenCatalog(CATALOG.chores).forEach(c => {
    pointsByChoreId[c.id] = c.defaultPoints;
  });
  flattenCatalog(CATALOG.rewards).forEach(r => {
    costByRewardId[r.id] = r.defaultCost;
  });

  return { enabledChores, enabledRewards, pointsByChoreId, costByRewardId, allowanceEnabled: false, pointsPerDollar: 600 };
}

export function useFamilyConfig() {
  const { family } = useAuth();
  return useQuery({
    queryKey: ["family_config", family?.familyId],
    enabled: !!family?.familyId,
    queryFn: async () => {
      const defaults = getDefaultCatalogConfig();
      return {
        id: family!.familyId,
        family_id: family!.familyId,
        enabled_chores: defaults.enabledChores,
        enabled_rewards: defaults.enabledRewards,
        points_by_chore_id: defaults.pointsByChoreId,
        cost_by_reward_id: defaults.costByRewardId,
        allowance_enabled: defaults.allowanceEnabled,
        points_per_dollar: defaults.pointsPerDollar,
      };
    },
  });
}

// --- Child Points ---

export function useChildPoints() {
  const { activeChildId } = useAuth();
  return useQuery({
    queryKey: ["child_points", activeChildId],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("child_points")
        .select("*")
        .eq("child_id", activeChildId!)
        .single();
      if (error) throw error;
      return data as { child_id: string; points: number; lifetime_points: number; updated_at: string };
    },
  });
}

// --- Chores ---

export function useChores() {
  const { activeChildId } = useAuth();
  const { data: config } = useFamilyConfig();

  return useQuery<EnabledChore[]>({
    queryKey: ["chores", activeChildId, config?.id],
    enabled: !!activeChildId && !!config,
    queryFn: async () => {
      if (!config || !activeChildId) return [];

      const today = localDateKey(new Date());
      const { data: dailyData } = await supabase
        .from("daily_status")
        .select("completed_chores")
        .eq("child_id", activeChildId)
        .eq("date_key", today)
        .single();

      const completedMap = (dailyData?.completed_chores as Record<string, boolean>) || {};
      const enabledMap = (config.enabled_chores as Record<string, boolean>) || {};
      const pointsMap = (config.points_by_chore_id as Record<string, number>) || {};

      return flattenCatalog(CATALOG.chores)
        .filter(c => enabledMap[c.id])
        .map(c => ({
          id: c.id,
          name: c.name,
          points: clampNumber(pointsMap[c.id] ?? c.defaultPoints, 0, 999999),
          completed: Boolean(completedMap[c.id]),
          categoryName: findCategoryName(CATALOG.chores, c.id),
        }));
    },
  });
}

export function useToggleChore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId, family } = useAuth();

  return useMutation({
    mutationFn: async (choreId: string) => {
      if (!activeChildId || !family) throw new Error("No child selected");

      const defaults = getDefaultCatalogConfig();
      const enabledMap = defaults.enabledChores;
      if (!enabledMap[choreId]) throw new Error("Chore not enabled");

      const today = localDateKey(new Date());

      let { data: dailyData } = await supabase
        .from("daily_status")
        .select("*")
        .eq("child_id", activeChildId)
        .eq("date_key", today)
        .single();

      if (!dailyData) {
        const { data: newDaily, error: insertErr } = await supabase
          .from("daily_status")
          .insert({ child_id: activeChildId, date_key: today, completed_chores: {} })
          .select()
          .single();
        if (insertErr) throw insertErr;
        dailyData = newDaily;
      }

      const completedMap = (dailyData.completed_chores as Record<string, boolean>) || {};
      const wasDone = Boolean(completedMap[choreId]);
      const nowDone = !wasDone;
      completedMap[choreId] = nowDone;

      await supabase
        .from("daily_status")
        .update({ completed_chores: completedMap })
        .eq("id", dailyData.id);

      const pointsMap = defaults.pointsByChoreId;
      const choreItem = flattenCatalog(CATALOG.chores).find(c => c.id === choreId);
      const pts = clampNumber(pointsMap[choreId] ?? choreItem?.defaultPoints ?? 0, 0, 999999);
      const pointsDelta = nowDone ? pts : -pts;

      await supabase.rpc("increment_child_points", {
        p_child_id: activeChildId,
        p_delta: pointsDelta,
        p_add_lifetime: nowDone,
      });

      await supabase.from("ledger_events").insert({
        family_id: family.familyId,
        child_id: activeChildId,
        type: nowDone ? "chore_completed" : "chore_unchecked",
        ref_id: choreId,
        points_delta: pointsDelta,
      });

      const chore: EnabledChore = {
        id: choreId,
        name: choreItem?.name || choreId,
        points: pts,
        completed: nowDone,
        categoryName: findCategoryName(CATALOG.chores, choreId),
      };

      return { chore, pointsDelta };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });

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
  const { activeChildId } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!activeChildId) throw new Error("No child selected");
      const today = localDateKey(new Date());

      const { data: dailyData } = await supabase
        .from("daily_status")
        .select("id")
        .eq("child_id", activeChildId)
        .eq("date_key", today)
        .single();

      if (dailyData) {
        await supabase
          .from("daily_status")
          .update({ completed_chores: {} })
          .eq("id", dailyData.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      toast({ title: "Ready for a new day!", description: "All chores have been reset." });
    },
  });
}

// --- Rewards ---

export function useRewards() {
  const { data: config } = useFamilyConfig();

  return useQuery<EnabledReward[]>({
    queryKey: ["rewards", config?.id],
    enabled: !!config,
    queryFn: async () => {
      if (!config) return [];
      const enabledMap = (config.enabled_rewards as Record<string, boolean>) || {};
      const costMap = (config.cost_by_reward_id as Record<string, number>) || {};

      return flattenCatalog(CATALOG.rewards)
        .filter(r => {
          if (r.id.startsWith("allow_") && !config.allowance_enabled) return false;
          return enabledMap[r.id];
        })
        .map(r => ({
          id: r.id,
          name: r.name,
          cost: clampNumber(costMap[r.id] ?? r.defaultCost, 0, 999999),
          category: findCategoryName(CATALOG.rewards, r.id),
        }));
    },
  });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId, family } = useAuth();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      if (!activeChildId || !family) throw new Error("No child selected");

      const defaults = getDefaultCatalogConfig();
      const enabledMap = defaults.enabledRewards;
      if (!enabledMap[rewardId]) throw new Error("Reward not enabled");

      if (rewardId.startsWith("allow_") && !defaults.allowanceEnabled) {
        throw new Error("Allowance is not enabled");
      }

      const rewardItem = flattenCatalog(CATALOG.rewards).find(r => r.id === rewardId);
      if (!rewardItem) throw new Error("Reward not found");

      const costMap = defaults.costByRewardId;
      let cost = clampNumber(costMap[rewardId] ?? rewardItem.defaultCost, 0, 999999);

      if (rewardId.startsWith("allow_")) {
        const dollars = rewardId === "allow_1" ? 1 : rewardId === "allow_5" ? 5 : 10;
        cost = defaults.pointsPerDollar * dollars;
      }

      const { data: pts } = await supabase
        .from("child_points")
        .select("points")
        .eq("child_id", activeChildId)
        .single();

      if (!pts || pts.points < cost) throw new Error("Not enough points");

      await supabase.rpc("increment_child_points", {
        p_child_id: activeChildId,
        p_delta: -cost,
        p_add_lifetime: false,
      });

      const { data: purchase } = await supabase
        .from("purchases")
        .insert({
          family_id: family.familyId,
          child_id: activeChildId,
          reward_id: rewardId,
          reward_name: rewardItem.name,
          cost,
        })
        .select()
        .single();

      await supabase.from("ledger_events").insert({
        family_id: family.familyId,
        child_id: activeChildId,
        type: "purchase",
        ref_id: rewardId,
        points_delta: -cost,
      });

      return { purchase, rewardName: rewardItem.name };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({
        title: "Reward Redeemed!",
        description: `You got ${data.rewardName}!`,
        className: "bg-secondary text-secondary-foreground border-none font-display",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot redeem", description: err.message, variant: "destructive" });
    },
  });
}

export function usePurchases() {
  const { activeChildId } = useAuth();
  return useQuery({
    queryKey: ["purchases", activeChildId],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("child_id", activeChildId!)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        reward_id: string;
        reward_name: string;
        cost: number;
        purchased_at: string;
      }>;
    },
  });
}

// --- User State (derived from child_points + family_settings) ---

export function useUserState() {
  const { data: pts } = useChildPoints();
  const { data: settings } = useFamilySettings();
  const { data: config } = useFamilyConfig();

  const combined = pts && settings ? {
    totalPoints: pts.points,
    totalEarnedLifetime: pts.lifetime_points,
    parentEmail: settings.primary_parent_email,
    secondaryParentEmail: settings.secondary_parent_email,
    allowanceEnabled: config?.allowance_enabled ?? false,
    pointsPerDollar: config?.points_per_dollar ?? 600,
    dailySummaryEnabled: settings.daily_summary_enabled ?? false,
    dailySummaryTimeLocal: settings.daily_summary_time_local ?? "19:30",
    dailySummaryTimezone: settings.timezone ?? "America/Denver",
  } : undefined;

  return { data: combined, isLoading: !pts || !settings };
}

// --- Config (for Parent Panel catalog — frontend constants for now) ---

export function useConfig() {
  const { data: config } = useFamilyConfig();

  const mapped = config ? {
    enabledChores: config.enabled_chores as Record<string, boolean>,
    enabledRewards: config.enabled_rewards as Record<string, boolean>,
    pointsByChoreId: config.points_by_chore_id as Record<string, number>,
    costByRewardId: config.cost_by_reward_id as Record<string, number>,
    allowanceEnabled: config.allowance_enabled,
    pointsPerDollar: config.points_per_dollar,
  } : undefined;

  return { data: mapped, isLoading: !config };
}

export function useUpdateChoreConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (_data: { enabledChores: Record<string, boolean>; pointsByChoreId: Record<string, number> }) => {
      // Phase 2: persist to family_config key/value store
      // For now, catalog config is frontend-only defaults
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_config"] });
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
    mutationFn: async (_data: { enabledRewards: Record<string, boolean>; costByRewardId: Record<string, number> }) => {
      // Phase 2: persist to family_config key/value store
      // For now, catalog config is frontend-only defaults
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_config"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: "Reward settings saved!" });
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
    mutationFn: async (settings: { parentEmail?: string | null; secondaryParentEmail?: string | null; allowanceEnabled?: boolean; pointsPerDollar?: number; dailySummaryEnabled?: boolean; dailySummaryTimeLocal?: string; dailySummaryTimezone?: string }) => {
      if (!family) throw new Error("No family");

      const updateData: any = {};
      if (settings.parentEmail !== undefined) updateData.primary_parent_email = settings.parentEmail;
      if (settings.secondaryParentEmail !== undefined) updateData.secondary_parent_email = settings.secondaryParentEmail;
      if (settings.dailySummaryEnabled !== undefined) updateData.daily_summary_enabled = settings.dailySummaryEnabled;
      if (settings.dailySummaryTimeLocal !== undefined) updateData.daily_summary_time_local = settings.dailySummaryTimeLocal;
      if (settings.dailySummaryTimezone !== undefined) updateData.timezone = settings.dailySummaryTimezone;
      updateData.updated_at = new Date().toISOString();

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

// --- Badges ---

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

// --- Bonus ---

export function useAwardBonus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeChildId, family } = useAuth();

  return useMutation({
    mutationFn: async (data: { reason: string; points: number; note?: string }) => {
      if (!activeChildId || !family) throw new Error("No child selected");

      const p = clampNumber(data.points, 1, 5000);

      await supabase.rpc("increment_child_points", {
        p_child_id: activeChildId,
        p_delta: p,
        p_add_lifetime: true,
      });

      const { data: event } = await supabase
        .from("ledger_events")
        .insert({
          family_id: family.familyId,
          child_id: activeChildId,
          type: "bonus_award",
          ref_id: data.reason,
          points_delta: p,
          note: data.note || null,
        })
        .select()
        .single();

      const { data: pts } = await supabase
        .from("child_points")
        .select("lifetime_points")
        .eq("child_id", activeChildId)
        .single();

      const newBadges = await checkAndAwardBadges(activeChildId, pts?.lifetime_points || 0);

      return { event, pointsDelta: p, newBadges };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["child_points"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });

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

// --- Ledger ---

export function useLedger() {
  const { activeChildId } = useAuth();
  return useQuery({
    queryKey: ["ledger", activeChildId],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_events")
        .select("*")
        .eq("child_id", activeChildId!)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

// --- Summary ---

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
  const { family, children: kids } = useAuth();
  const { data: config } = useFamilyConfig();

  return useQuery<FamilySummary | null>({
    queryKey: ["family_summary", family?.familyId, date],
    enabled: !!family && !!config && kids.length > 0,
    queryFn: async () => {
      if (!family || !config || kids.length === 0) return null;

      const today = date || localDateKey(new Date());
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      const enabledMap = (config.enabled_chores as Record<string, boolean>) || {};
      const allChores = flattenCatalog(CATALOG.chores);

      const childSummaries: ChildDailySummary[] = [];

      for (const kid of kids) {
        const [eventsRes, dailyRes, pointsRes, purchasesRes] = await Promise.all([
          supabase
            .from("ledger_events")
            .select("*")
            .eq("child_id", kid.id)
            .gte("occurred_at", startOfDay)
            .lte("occurred_at", endOfDay)
            .order("occurred_at"),
          supabase
            .from("daily_status")
            .select("completed_chores")
            .eq("child_id", kid.id)
            .eq("date_key", today)
            .single(),
          supabase
            .from("child_points")
            .select("points")
            .eq("child_id", kid.id)
            .single(),
          supabase
            .from("purchases")
            .select("reward_name, cost")
            .eq("child_id", kid.id)
            .gte("purchased_at", startOfDay)
            .lte("purchased_at", endOfDay),
        ]);

        const completedMap = (dailyRes.data?.completed_chores as Record<string, boolean>) || {};
        const completedChores: string[] = [];
        const missedChores: string[] = [];
        allChores.forEach(c => {
          if (!enabledMap[c.id]) return;
          if (completedMap[c.id]) {
            completedChores.push(c.name);
          } else {
            missedChores.push(c.name);
          }
        });

        const eventsArr = eventsRes.data || [];
        const bonuses = eventsArr
          .filter((e: any) => e.type === "bonus_award")
          .map((e: any) => ({ reason: e.ref_id, points: e.points_delta, note: e.note }));

        const redemptions = (purchasesRes.data || []).map((p: any) => ({
          name: p.reward_name,
          cost: p.cost,
        }));

        const pointsEarnedToday = eventsArr.reduce((sum: number, e: any) => sum + e.points_delta, 0);

        childSummaries.push({
          childName: kid.displayName,
          completedChores,
          missedChores,
          bonuses,
          redemptions,
          pointsEarnedToday,
          currentBalance: pointsRes.data?.points || 0,
        });
      }

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
