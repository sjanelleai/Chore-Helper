import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ArrowLeft } from "lucide-react";

export default function ParentUnlock() {
  const { family } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = new URLSearchParams(search).get("next") || "/parent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || pin.length < 4) return;

    setError(null);
    setLoading(true);

    try {
      const { data, error: rpcErr } = await supabase.rpc("verify_parent_portal_pin", {
        p_family_id: family.familyId,
        p_pin: pin,
      });

      if (rpcErr) throw rpcErr;

      const result = typeof data === "string" ? JSON.parse(data) : data;

      if (result?.ok) {
        const { data: settingsData } = await supabase
          .from("family_settings")
          .select("parent_portal_pin_timeout_minutes")
          .eq("family_id", family.familyId)
          .single();

        const timeout = settingsData?.parent_portal_pin_timeout_minutes || 15;
        sessionStorage.setItem(
          "parentPortalUnlockedUntil",
          String(Date.now() + timeout * 60_000)
        );
        navigate(nextPath);
      } else {
        setError(result?.error || "Wrong PIN");
        setPin("");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-unlock-title">
            Parent Zone
          </h1>
          <p className="text-muted-foreground mt-1">Enter your Parent Portal PIN</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPin(v);
              }}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="Enter PIN"
              className="w-full p-4 rounded-xl border bg-background text-foreground font-mono text-2xl tracking-[0.5em] text-center"
              data-testid="input-parent-pin"
            />

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl text-center" data-testid="text-unlock-error">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || pin.length < 4} data-testid="button-unlock">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Unlock
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-primary font-bold hover:underline"
            data-testid="link-back-from-unlock"
          >
            <ArrowLeft className="w-3 h-3 inline mr-1" />
            Back to Home
          </button>
        </p>
      </div>
    </div>
  );
}
