import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { parseHashParams, hasHashError, getHashErrorMessage } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, CheckCircle, AlertCircle, Eye, EyeOff, Mail } from "lucide-react";

const SITE_URL = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

type PageState = "loading" | "expired" | "form" | "no-session" | "success";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

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
        setPageState("form");
        return;
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
        setPageState("form");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPageState("form");
      } else {
        setPageState("no-session");
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setPageState("success");
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login?reset=success"), 1500);
  };

  const handleResendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);

    if (!resendEmail) {
      setResendError("Please enter your email");
      return;
    }

    setResendLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    setResendLoading(false);

    if (error) {
      setResendError(error.message);
    } else {
      setResendSent(true);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-reset-loading">Checking link...</p>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-reset-success">
            Password Updated!
          </h1>
          <p className="text-muted-foreground mb-6">
            Your new password has been saved. Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "expired" || pageState === "no-session") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-reset-expired">
              {pageState === "expired" ? "Link Expired" : "No Active Session"}
            </h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage || "This reset link has expired or is invalid. Enter your email to request a new one."}
            </p>

            {resendSent ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl mb-4">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium" data-testid="text-resend-reset-sent">
                  Reset link sent! Check your email.
                </p>
              </div>
            ) : (
              <form onSubmit={handleResendReset} className="space-y-3 text-left">
                <div>
                  <label className="text-sm font-bold text-muted-foreground mb-1 block">Email</label>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    placeholder="parent@example.com"
                    className="w-full p-3 rounded-xl border bg-background text-foreground"
                    data-testid="input-resend-email"
                  />
                </div>

                {resendError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-resend-error">
                    {resendError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={resendLoading} data-testid="button-resend-reset">
                  {resendLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Mail className="w-4 h-4 mr-2" />
                  Send Reset Link
                </Button>
              </form>
            )}

            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => navigate("/login")}
              data-testid="button-back-to-login"
            >
              Back to Sign In
            </Button>
          </Card>
        </div>
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
            Set New Password
          </h1>
          <p className="text-muted-foreground mt-1">Choose a new password for your account</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  placeholder="Minimum 8 characters"
                  className="w-full p-3 rounded-xl border bg-background text-foreground pr-12"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                placeholder="Repeat new password"
                className="w-full p-3 rounded-xl border bg-background text-foreground"
                data-testid="input-confirm-password"
              />
            </div>

            {formError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-reset-form-error">
                {formError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting} data-testid="button-update-password">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
