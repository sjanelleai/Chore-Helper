import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function AuthReset() {
  const [, navigate] = useLocation();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const url = new URL(window.location.href);
      const queryCode = url.searchParams.get("code");

      if (queryCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(queryCode);
        if (error) {
          setSessionError(true);
          return;
        }
        setSessionReady(true);
        return;
      }

      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setSessionError(true);
            return;
          }
          setSessionReady(true);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
      } else {
        setSessionError(true);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin.length !== 6) {
      setError("PIN must be exactly 6 digits");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs don't match");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPin,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-reset-success">
            PIN Updated!
          </h1>
          <p className="text-muted-foreground mb-6">
            Your new PIN has been saved. You can now sign in.
          </p>
          <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-go-login-after-reset">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Card className="p-6">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-reset-expired">
              Link Expired
            </h1>
            <p className="text-muted-foreground mb-6">
              This reset link has expired or is invalid. Please request a new one from the sign-in page.
            </p>
            <Button className="w-full" onClick={() => navigate("/login")} data-testid="button-expired-login">
              Go to Sign In
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-reset-title">
            Set New PIN
          </h1>
          <p className="text-muted-foreground mt-1">Choose a new 6-digit PIN for your account</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">New 6-Digit PIN</label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  value={newPin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setNewPin(v);
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="Enter new PIN"
                  className="w-full p-3 rounded-xl border bg-background text-foreground font-mono text-lg tracking-widest pr-12"
                  data-testid="input-new-pin"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Confirm PIN</label>
              <input
                type={showPin ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setConfirmPin(v);
                }}
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="Repeat new PIN"
                className="w-full p-3 rounded-xl border bg-background text-foreground font-mono text-lg tracking-widest"
                data-testid="input-confirm-new-pin"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-reset-error">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-update-pin">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update PIN
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
