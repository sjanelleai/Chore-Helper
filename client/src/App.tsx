import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
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
import AuthReset from "@/pages/AuthReset";
import { Loader2 } from "lucide-react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const publicRoutes = ["/login", "/signup", "/auth/callback", "/auth/reset"];
  if (!session) {
    if (!publicRoutes.some(r => location.startsWith(r))) {
      return <Redirect to="/login" />;
    }
  }

  return <>{children}</>;
}

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { activeChildId, session } = useAuth();

  if (!session) return <Redirect to="/login" />;
  if (!activeChildId) return <Redirect to="/select-child" />;

  return <>{children}</>;
}

function Router() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/auth/reset" component={AuthReset} />
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
        <Route path="/parent">
          <AppLayout><ParentPanel /></AppLayout>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
