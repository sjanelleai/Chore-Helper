import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { saveKidSession } from "@/lib/kid-session";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";

export default function KidJoin() {
  const { setKidSession } = useAuth();
  const [, navigate] = useLocation();

  const [familyNumber, setFamilyNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!familyNumber.trim()) {
      setError("Please enter a family number");
      return;
    }
    if (pin.length < 4) {
      setError("PIN must be 4 digits");
      return;
    }

    setLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("verify_kid_join", {
        p_family_number: familyNumber.trim().toUpperCase(),
        p_pin: pin,
      });

      if (rpcErr) throw rpcErr;

      const result = typeof data === "string" ? JSON.parse(data) : data;

      if (!result?.ok) {
        if (result?.error === "family_not_found") {
          setError("Family not found. Check your family number.");
        } else if (result?.error === "invalid_pin") {
          setError("Wrong PIN. Try again!");
        } else {
          setError(result?.error || "Something went wrong");
        }
        setLoading(false);
        return;
      }

      // verify_kid_join now returns the specific child whose PIN matched
      const fullSession = {
        familyId: result.family_id,
        familyNumber: familyNumber.trim().toUpperCase(),
        kidToken: result.kid_token,
        childId: result.child_id,
        childName: result.child_name,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      saveKidSession(fullSession);
      setKidSession(fullSession);
      navigate("/");
    } catch (err: any) {
      const msg = [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ");
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/30">
            <Users className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-kid-join-title">
            Join a Family
          </h1>
          <p className="text-muted-foreground mt-1">Enter your family number and PIN</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Family Number</label>
              <input
                type="text"
                value={familyNumber}
                onChange={(e) => setFamilyNumber(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                className="w-full p-3 rounded-xl border bg-background text-foreground font-mono text-lg tracking-widest text-center uppercase"
                data-testid="input-family-number"
                maxLength={6}
              />
            </div>

            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 block">Kid PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(v);
                }}
                inputMode="numeric"
                maxLength={4}
                placeholder="4-digit PIN"
                className="w-full p-3 rounded-xl border bg-background text-foreground font-mono text-2xl tracking-[0.5em] text-center"
                data-testid="input-kid-pin"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl" data-testid="text-join-error">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-join-family">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Join!
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/login" className="text-primary font-bold hover:underline" data-testid="link-parent-login">
            I'm a Parent
          </Link>
        </p>
      </div>
    </div>
  );
}
