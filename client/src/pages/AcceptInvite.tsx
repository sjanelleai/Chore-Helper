import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import {
  parseHashParams,
  hasHashError,
  getHashErrorMessage,
  checkOnboardingReady,
  routeAfterAuth,
} from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, UserPlus } from "lucide-react";

type PageState = "loading" | "expired" | "no-session" | "routing";

export default function AcceptInvite() {
  const [, navigate] = useLocation();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      const hash = parseHashParams();

      if (hasHashError(hash)) {
        setErrorMessage(getHashErrorMessage(hash));
        setPageState("expired");
        return;
      }

      if (hash.accessToken && hash.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: hash.accessToken,
          refresh_token: hash.refreshToken,
        });
        if (error) {
          setErrorMessage(error.message);
          setPageState("expired");
          return;
        }
      }

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage(error.message);
          setPageState("expired");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setPageState("no-session");
        return;
      }

      setPageState("routing");
      const status = await checkOnboardingReady();
      const destination = routeAfterAuth(status);
      navigate(destination);
    };

    init();
  }, [navigate]);

  if (pageState === "loading" || pageState === "routing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-invite-loading">
            {pageState === "routing" ? "Setting up your account..." : "Checking invite..."}
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-invite-expired">
              Invite Expired
            </h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage || "This invite link has expired or is invalid. Please ask the parent or admin to resend the invite."}
            </p>
            <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-invite-login">
              Go to Sign In
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card className="p-6 text-center">
          <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-invite-invalid">
            Invalid Invite Link
          </h1>
          <p className="text-muted-foreground mb-6">
            This invite link is invalid or has expired. Please sign in or request a new invite.
          </p>
          <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-invite-go-login">
            Go to Sign In
          </Button>
        </Card>
      </div>
    </div>
  );
}
