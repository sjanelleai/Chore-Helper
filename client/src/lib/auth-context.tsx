import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface FamilyProfile {
  familyId: string;
  parentDisplayName: string;
}

interface ChildProfile {
  id: string;
  name: string;
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

  const loadFamilyData = useCallback(async (userId: string, retries = 3) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data: profile, error: pErr } = await supabase
        .from("parent_profiles")
        .select("family_id, parent_display_name")
        .eq("user_id", userId)
        .single();

      if (pErr || !profile) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        console.log("[auth] No parent_profiles row found after retries. Attempting fallback family creation...");
        const created = await createFamilyFallback(userId);
        if (created) {
          setFamily({
            familyId: created.familyId,
            parentDisplayName: created.displayName,
          });
          setChildrenList([]);
          return;
        }

        setFamily(null);
        setChildrenList([]);
        return;
      }

      setFamily({
        familyId: profile.family_id,
        parentDisplayName: profile.parent_display_name || "Parent",
      });

      const { data: kids } = await supabase
        .from("children")
        .select("id, name, avatar, pin_hash")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: true });

      if (kids) {
        setChildrenList(
          kids.map((k: any) => ({
            id: k.id,
            name: k.name,
            avatar: k.avatar,
            hasPin: !!k.pin_hash,
          }))
        );
      }
      return;
    }
  }, []);

  const createFamilyFallback = async (_userId: string): Promise<{ familyId: string; displayName: string } | null> => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const displayName = currentUser?.user_metadata?.name || "Parent";

      const { data, error } = await supabase.rpc("ensure_family_exists", {
        p_display_name: displayName,
      });

      if (error) {
        console.error("[auth] Fallback RPC ensure_family_exists failed:", error);
        return null;
      }

      const result = typeof data === "string" ? JSON.parse(data) : data;

      if (result?.error) {
        console.error("[auth] Fallback RPC returned error:", result.error);
        return null;
      }

      if (result?.family_id) {
        console.log("[auth] Fallback: successfully ensured family exists", result);
        return { familyId: result.family_id, displayName: result.display_name || displayName };
      }

      console.error("[auth] Fallback RPC returned unexpected data:", result);
      return null;
    } catch (err) {
      console.error("[auth] Fallback family creation failed", err);
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
    if (user) await loadFamilyData(user.id);
  };

  const refreshFamily = async () => {
    if (user) await loadFamilyData(user.id);
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
