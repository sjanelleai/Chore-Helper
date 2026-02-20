import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ensureCatalogSeeded } from "./catalogSeed";
import { queryClient } from "./queryClient";

interface FamilyProfile {
  familyId: string;
  parentDisplayName: string;
}

interface ChildProfile {
  id: string;
  displayName: string;
  avatar: string | null;
  hasPin: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  family: FamilyProfile | null;
  children: ChildProfile[];
  activeChildId: string | null;
  activeChild: ChildProfile | null;
  loading: boolean;
  authError: string | null;
  catalogSeedError: string | null;
  retryCatalogSeed: () => Promise<void>;
  signUp: (email: string, pin: string, name?: string) => Promise<{ error: string | null; needsVerification?: boolean }>;
  signIn: (email: string, pin: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  selectChild: (childId: string) => void;
  clearChild: () => void;
  refreshChildren: () => Promise<void>;
  refreshFamily: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children: childrenNodes }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<FamilyProfile | null>(null);
  const [childrenList, setChildrenList] = useState<ChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(
    localStorage.getItem("activeChildId")
  );
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [catalogSeedError, setCatalogSeedError] = useState<string | null>(null);

  const seedCatalogForFamily = useCallback(async (familyId: string) => {
    try {
      setCatalogSeedError(null);
      const result = await ensureCatalogSeeded({ supabase, queryClient, familyId });
      if (result.seeded) {
        console.log("[auth] Default catalog seeded for family:", familyId);
      }
    } catch (err: any) {
      const msg = [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ");
      console.error("[auth] Catalog seeding failed:", msg, err);
      setCatalogSeedError(msg || "Failed to set up default chores and rewards.");
    }
  }, []);

  const loadChildren = useCallback(async (familyId: string) => {
    const { data: kids, error } = await supabase
      .from("children")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[auth] Failed to load children:", error);
      setChildrenList([]);
      return;
    }

    if (kids) {
      setChildrenList(
        kids.map((k: any) => ({
          id: k.id,
          displayName: k.display_name || "Child",
          avatar: k.avatar ?? null,
          hasPin: !!(k.pin_hash),
        }))
      );
    }
  }, []);

  const loadFamilyData = useCallback(async (userId: string) => {
    setAuthError(null);

    const { data: membership, error: mErr } = await supabase
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (mErr || !membership) {
      console.log("[auth] No family_members row found. Calling ensure_family_exists RPC...");
      const created = await createFamilyFallback();
      if (created) {
        setFamily({
          familyId: created.familyId,
          parentDisplayName: created.displayName,
        });
        setChildrenList([]);
        await seedCatalogForFamily(created.familyId);
        return;
      }
      setFamily(null);
      setChildrenList([]);
      return;
    }

    const familyId = membership.family_id;

    const { data: fam } = await supabase
      .from("families")
      .select("name")
      .eq("id", familyId)
      .single();

    setFamily({
      familyId,
      parentDisplayName: fam?.name || "My Family",
    });

    await loadChildren(familyId);
    await seedCatalogForFamily(familyId);
  }, [loadChildren, seedCatalogForFamily]);

  const createFamilyFallback = async (): Promise<{ familyId: string; displayName: string } | null> => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const displayName = currentUser?.user_metadata?.name || "Parent";

      const { data, error } = await supabase.rpc("ensure_family_exists", {
        p_display_name: displayName,
      });

      if (error) {
        const errMsg = `Family setup failed: ${error.message}${error.details ? ` (${error.details})` : ""}`;
        console.error("[auth] ensure_family_exists RPC failed:", error);
        setAuthError(errMsg);
        return null;
      }

      const result = typeof data === "string" ? JSON.parse(data) : data;

      if (result?.error) {
        const errMsg = `Family setup failed: ${result.error}`;
        console.error("[auth] ensure_family_exists returned error:", result.error);
        setAuthError(errMsg);
        return null;
      }

      if (result?.family_id) {
        console.log("[auth] Family created successfully:", result);
        setAuthError(null);
        return { familyId: result.family_id, displayName: result.display_name || displayName };
      }

      const errMsg = "Family setup returned unexpected data. Please try signing out and back in.";
      console.error("[auth] ensure_family_exists returned unexpected data:", result);
      setAuthError(errMsg);
      return null;
    } catch (err: any) {
      const errMsg = `Family setup error: ${err?.message || "Unknown error"}`;
      console.error("[auth] createFamilyFallback exception:", err);
      setAuthError(errMsg);
      return null;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadFamilyData(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadFamilyData(s.user.id);
      } else {
        setFamily(null);
        setChildrenList([]);
        setActiveChildId(null);
        setAuthError(null);
        localStorage.removeItem("activeChildId");
      }
    });

    return () => subscription.unsubscribe();
  }, [loadFamilyData]);

  const signUp = async (email: string, pin: string, name?: string) => {
    const siteUrl = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pin,
      options: {
        data: { name: name || "Parent" },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    const needsVerification = data?.user && !data.session;
    return { error: null, needsVerification: !!needsVerification };
  };

  const signIn = async (email: string, pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOutFn = async () => {
    await supabase.auth.signOut();
    setActiveChildId(null);
    localStorage.removeItem("activeChildId");
  };

  const selectChild = (childId: string) => {
    setActiveChildId(childId);
    localStorage.setItem("activeChildId", childId);
  };

  const clearChild = () => {
    setActiveChildId(null);
    localStorage.removeItem("activeChildId");
  };

  const refreshChildren = async () => {
    if (family) await loadChildren(family.familyId);
  };

  const refreshFamily = async () => {
    if (user) await loadFamilyData(user.id);
  };

  const retryCatalogSeed = async () => {
    if (family) await seedCatalogForFamily(family.familyId);
  };

  const activeChild = childrenList.find((c) => c.id === activeChildId) || null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        family,
        children: childrenList,
        activeChildId,
        activeChild,
        loading,
        authError,
        catalogSeedError,
        retryCatalogSeed,
        signUp,
        signIn,
        signOut: signOutFn,
        selectChild,
        clearChild,
        refreshChildren,
        refreshFamily,
      }}
    >
      {childrenNodes}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
