import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Link, useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Eye, EyeOff, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SITE_URL = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export default function Login() {
  const { signIn } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("reset") === "success") {
      toast({
        title: "Password updated",
        description: "Please sign in with your new password.",
      });
    }
  }, [search, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      const msg = result.error.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setUnverifiedEmail(email);
        setError(null);
      } else {
        setError(result.error);
      }
    } else {
      navigate("/select-child");
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unverifiedEmail,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    });
    setResending(false);
    if (!error) setResendSent(true);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!forgotEmail) {
      setForgotError("Please enter your email");
      return;
    }

    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    setForgotLoading(false);

    if (error) {
      setForgotError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  if (unverifiedEmail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-unverified-title">
            Verify Your Email
          </h1>
          <p className="text-muted-foreground mb-6">
            Your email <span className="font-bold text-foreground">{unverifiedEmail}</span> hasn't been verified yet. Check your inbox for the verification link.
          </p>

          {resendSent ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl mb-4">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium" data-testid="text-resend-success">
                Verification email sent! Check your inbox.
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full mb-3"
              onClick={handleResendVerification}
              disabled={resending}
              data-testid="button-resend-verification"
            >
              {resending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Resend Verification Email
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setUnverifiedEmail(null); setResendSent(false); }}
            data-testid="button-back-to-login"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (showForgot) {
    if (forgotSent) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-forgot-sent">
              Check Your Email
            </h1>
            <p className="text-muted-foreground mb-6">
              We sent a password reset link to <span className="font-bold text-foreground">{forgotEmail}</span>. Click the link in the email to set a new password.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
              data-testid="button-back-to-login-from-forgot"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-forgot-title">
              Reset Password
            </h1>
            <p className="text-muted-foreground mt-1">We'll email you a link to set a new password</p>
          </div>

          <Card className="p-6">
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  placeholder="parent@example.com"
                  className="w-full p-3 rounded-xl border bg-background text-foreground"
                  data-testid="input-forgot-email"
                />
              </div>

              {forgotError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-forgot-error">
                  {forgotError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={forgotLoading} data-testid="button-send-reset">
                {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send Reset Link
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <button
              onClick={() => { setShowForgot(false); setForgotError(null); }}
              className="text-primary font-bold hover:underline"
              data-testid="link-back-to-login"
            >
              Back to Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-login-title">
            HomeQuest
          </h1>
          <p className="text-muted-foreground mt-1">Parent Sign In</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="parent@example.com"
                className="w-full p-3 rounded-xl border bg-background text-foreground"
                data-testid="input-email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <label className="text-sm font-bold text-muted-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                  className="text-xs text-primary font-bold hover:underline"
                  data-testid="link-forgot-password"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  placeholder="Enter your password"
                  className="w-full p-3 rounded-xl border bg-background text-foreground pr-12"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-error">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-sign-in">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sign In
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-bold hover:underline" data-testid="link-signup">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
