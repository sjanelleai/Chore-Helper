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
  signUp: (email: string, pin: string, name?: string) => Promise<{ error: string | null }>;
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

  const loadFamilyData = useCallback(async (userId: string) => {
    const { data: profile, error: pErr } = await supabase
      .from("parent_profiles")
      .select("family_id, parent_display_name")
      .eq("user_id", userId)
      .single();

    if (pErr || !profile) {
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
  }, []);

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
    const { error } = await supabase.auth.signUp({
      email,
      password: pin,
      options: { data: { name: name || "Parent" } },
    });
    if (error) return { error: error.message };
    return { error: null };
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
