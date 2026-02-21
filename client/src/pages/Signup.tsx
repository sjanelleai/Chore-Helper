import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Eye, EyeOff, Mail, CheckCircle, RefreshCw } from "lucide-react";

const SITE_URL = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export default function Signup() {
  const { signUp } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const result = await signUp(email, password, name.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.needsVerification) {
      setNeedsVerification(true);
      setSuccess(true);
    } else {
      setSuccess(true);
    }
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    });
    setResending(false);
    if (!error) setResendSent(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
            {needsVerification ? <Mail className="w-8 h-8 text-white" /> : <Shield className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2" data-testid="text-signup-success">
            Account Created!
          </h1>
          {needsVerification ? (
            <>
              <p className="text-muted-foreground mb-6">
                We sent a verification email to <span className="font-bold text-foreground">{email}</span>. Click the link in the email to activate your account.
              </p>

              {resendSent ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl mb-4">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium" data-testid="text-resend-success">
                    Verification email resent!
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mb-3"
                  onClick={handleResend}
                  disabled={resending}
                  data-testid="button-resend-verification"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Resend Verification Email
                </Button>
              )}
            </>
          ) : (
            <p className="text-muted-foreground mb-6">
              Your account is ready. Sign in to get started!
            </p>
          )}

          <Link href="/login">
            <Button className="w-full" data-testid="button-go-to-login">Go to Sign In</Button>
          </Link>
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
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-signup-title">
            HomeQuest
          </h1>
          <p className="text-muted-foreground mt-1">Create Parent Account</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Parent's Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full p-3 rounded-xl border bg-background text-foreground"
                data-testid="input-name"
              />
            </div>

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
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  placeholder="Minimum 8 characters"
                  className="w-full p-3 rounded-xl border bg-background text-foreground pr-12"
                  data-testid="input-password"
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
                placeholder="Repeat password"
                className="w-full p-3 rounded-xl border bg-background text-foreground"
                data-testid="input-confirm-password"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-error">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-sign-up">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Account
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline" data-testid="link-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
