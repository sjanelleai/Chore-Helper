import { supabase } from "./supabase";

export interface HashParams {
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export function parseHashParams(): HashParams {
  const raw = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);

  return {
    error: params.get("error"),
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description"),
    type: params.get("type"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

export function hasHashError(hash: HashParams): boolean {
  return !!(hash.errorCode || hash.error);
}

export function getHashErrorMessage(hash: HashParams): string {
  if (hash.errorDescription) {
    return decodeURIComponent(hash.errorDescription.replace(/\+/g, " "));
  }
  if (hash.errorCode === "otp_expired") {
    return "This link has expired. Please request a new one.";
  }
  return hash.error || "This link is invalid or has expired.";
}

export interface OnboardingStatus {
  ready: boolean;
  familyId: string | null;
  hasChildren: boolean;
}

export async function checkOnboardingReady(): Promise<OnboardingStatus> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ready: false, familyId: null, hasChildren: false };
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return { ready: false, familyId: null, hasChildren: false };
  }

  const familyId = membership.family_id;

  const { count } = await supabase
    .from("children")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);

  const hasChildren = (count ?? 0) > 0;

  return {
    ready: hasChildren,
    familyId,
    hasChildren,
  };
}

export function routeAfterAuth(status: OnboardingStatus): string {
  if (!status.ready) {
    return "/select-child";
  }
  return "/";
}
