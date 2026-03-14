import React, { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { AppLayout } from "@/components/Navigation";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Chores from "@/pages/Chores";
import Rewards from "@/pages/Rewards";
import Badges from "@/pages/Badges";
import ParentPanel from "@/pages/ParentPanel";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import SelectChild from "@/pages/SelectChild";
import AuthCallback from "@/pages/AuthCallback";
import ResetPassword from "@/pages/ResetPassword";
import AcceptInvite from "@/pages/AcceptInvite";
import KidJoin from "@/pages/KidJoin";
import ParentUnlock from "@/pages/ParentUnlock";
import { Loader2 } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Something went wrong</h1>
          <p className="text-muted-foreground text-sm mb-4">Please refresh the page to try again.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-primary underline text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, mode } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const publicRoutes = ["/login", "/signup", "/auth/callback", "/reset-password", "/accept-invite", "/join"];
  if (mode === "guest") {
    if (!publicRoutes.some(r => location.startsWith(r))) {
      return <Redirect to="/login" />;
    }
  }

  if (mode === "parent" && (location === "/login" || location === "/signup" || location === "/join")) {
    return <Redirect to="/" />;
  }
  if (mode === "kid" && (location === "/login" || location === "/signup" || location === "/join")) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { activeChildId, session, mode, kidSession } = useAuth();

  if (mode === "kid") {
    if (!kidSession?.childId) return <Redirect to="/join" />;
    return <>{children}</>;
  }

  if (!session) return <Redirect to="/login" />;
  if (!activeChildId) return <Redirect to="/select-child" />;

  return <>{children}</>;
}

function ParentGuard({ children }: { children: React.ReactNode }) {
  const { mode, family } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    if (mode !== "parent" || !family?.familyId) {
      setChecking(false);
      return;
    }

    const unlockUntil = sessionStorage.getItem("parentPortalUnlockedUntil");
    if (unlockUntil && Date.now() < Number(unlockUntil)) {
      setChecking(false);
      return;
    }

    supabase
      .from("family_settings")
      .select("parent_portal_pin_hash")
      .eq("family_id", family.familyId)
      .single()
      .then(({ data, error }) => {
        // PGRST116 = "not found" — new family has no settings row yet, no PIN
        if (error && error.code !== "PGRST116") {
          setNeedsPin(true);
          setChecking(false);
          return;
        }
        if (data?.parent_portal_pin_hash) {
          setNeedsPin(true);
        }
        setChecking(false);
      })
      .catch(() => {
        setNeedsPin(true);
        setChecking(false);
      });
  }, [mode, family?.familyId]);

  if (mode === "kid") return <Redirect to="/" />;
  if (mode === "guest") return <Redirect to="/login" />;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsPin) return <Redirect to="/parent/unlock?next=/parent" />;

  return <>{children}</>;
}

function ParentOnlyGuard({ children }: { children: React.ReactNode }) {
  const { mode } = useAuth();
  if (mode === "kid") return <Redirect to="/" />;
  if (mode === "guest") return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/accept-invite" component={AcceptInvite} />
        <Route path="/join" component={KidJoin} />
        <Route path="/select-child" component={SelectChild} />
        <Route path="/">
          <ChildGuard><AppLayout><Home /></AppLayout></ChildGuard>
        </Route>
        <Route path="/chores">
          <ChildGuard><AppLayout><Chores /></AppLayout></ChildGuard>
        </Route>
        <Route path="/rewards">
          <ChildGuard><AppLayout><Rewards /></AppLayout></ChildGuard>
        </Route>
        <Route path="/badges">
          <ChildGuard><AppLayout><Badges /></AppLayout></ChildGuard>
        </Route>
        <Route path="/parent/unlock">
          <ParentOnlyGuard><ParentUnlock /></ParentOnlyGuard>
        </Route>
        <Route path="/parent">
          <ParentGuard><AppLayout><ParentPanel /></AppLayout></ParentGuard>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
