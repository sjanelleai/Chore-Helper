import { useAuth } from "@/lib/auth-context";
import {
  useChoreCatalog,
  useRewardCatalog,
  useChildPoints,
  useChores,
  useToggleChore,
  useRewards,
  useRedeemReward,
  useBadges,
  useRedemptions,
} from "./use-data";
import {
  useKidChoreCatalog,
  useKidRewardCatalog,
  useKidChildPoints,
  useKidChores,
  useKidToggleChore,
  useKidRewards,
  useKidRedeemReward,
  useKidBadges,
  useKidRedemptions,
} from "./use-kid-data";

export function useModeChildId(): string | null {
  const { mode, activeChildId, kidSession } = useAuth();
  return mode === "kid" ? kidSession?.childId || null : activeChildId;
}

export function useModeChoreCatalog() {
  const { mode } = useAuth();
  const parentResult = useChoreCatalog();
  const kidResult = useKidChoreCatalog();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeRewardCatalog() {
  const { mode } = useAuth();
  const parentResult = useRewardCatalog();
  const kidResult = useKidRewardCatalog();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeChildPoints() {
  const { mode } = useAuth();
  const parentResult = useChildPoints();
  const kidResult = useKidChildPoints();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeChores() {
  const { mode } = useAuth();
  const parentResult = useChores();
  const kidResult = useKidChores();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeToggleChore() {
  const { mode } = useAuth();
  const parentResult = useToggleChore();
  const kidResult = useKidToggleChore();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeRewards() {
  const { mode } = useAuth();
  const parentResult = useRewards();
  const kidResult = useKidRewards();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeRedeemReward() {
  const { mode } = useAuth();
  const parentResult = useRedeemReward();
  const kidResult = useKidRedeemReward();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeBadges() {
  const { mode } = useAuth();
  const parentResult = useBadges();
  const kidResult = useKidBadges();
  return mode === "kid" ? kidResult : parentResult;
}

export function useModeRedemptions() {
  const { mode } = useAuth();
  const parentResult = useRedemptions();
  const kidResult = useKidRedemptions();
  return mode === "kid" ? kidResult : parentResult;
}
