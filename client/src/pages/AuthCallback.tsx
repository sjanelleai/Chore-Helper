import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CallbackState = "processing" | "success" | "error" | "expired";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<CallbackState>("processing");
  const [errorMsg, setErrorMsg] = useState("");
  const [callbackType, setCallbackType] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.replace("#", "?"));
        const queryCode = url.searchParams.get("code");
        const type = hashParams.get("type") || url.searchParams.get("type") || "";
        const hashError = hashParams.get("error_description") || url.searchParams.get("error_description");
        setCallbackType(type);

        if (hashError) {
          const msg = decodeURIComponent(hashError);
          if (msg.toLowerCase().includes("expired")) {
            setState("expired");
          } else {
            setErrorMsg(msg);
            setState("error");
          }
          return;
        }

        if (type === "recovery") {
          if (queryCode) {
            navigate("/auth/reset?code=" + queryCode);
          } else {
            navigate("/auth/reset" + window.location.hash);
          }
          return;
        }

        if (queryCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(queryCode);
          if (error) {
            if (error.message?.toLowerCase().includes("expired")) {
              setState("expired");
            } else {
              setErrorMsg(error.message);
              setState("error");
            }
            return;
          }
          setState("success");
          setTimeout(() => navigate("/select-child"), 1500);
          return;
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            if (error.message?.toLowerCase().includes("expired")) {
              setState("expired");
            } else {
              setErrorMsg(error.message);
              setState("error");
            }
            return;
          }
          setState("success");
          setTimeout(() => navigate("/select-child"), 1500);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setState("success");
          setTimeout(() => navigate("/select-child"), 1500);
        } else {
          setState("success");
          setTimeout(() => navigate("/login"), 1500);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Something went wrong");
        setState("error");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {state === "processing" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-callback-processing">
              Signing you in...
            </h1>
            <p className="text-muted-foreground">Please wait while we verify your account.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-callback-success">
              {callbackType === "signup" ? "Email Verified!" : "Success!"}
            </h1>
            <p className="text-muted-foreground">Redirecting you to the app...</p>
          </>
        )}

        {state === "expired" && (
          <Card className="p-6">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-callback-expired">
              Link Expired
            </h1>
            <p className="text-muted-foreground mb-6">
              This verification link has expired. Please request a new one.
            </p>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-go-login">
                Go to Sign In
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/signup")} data-testid="button-go-signup">
                Create New Account
              </Button>
            </div>
          </Card>
        )}

        {state === "error" && (
          <Card className="p-6">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-callback-error">
              Something Went Wrong
            </h1>
            <p className="text-muted-foreground mb-2">
              {errorMsg || "We couldn't complete the verification."}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Try signing in again or request a new link.
            </p>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-error-login">
                Go to Sign In
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
