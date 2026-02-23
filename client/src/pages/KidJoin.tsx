import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { saveKidSession, updateKidSessionChild } from "@/lib/kid-session";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, ArrowLeft, User } from "lucide-react";

interface ChildOption {
  child_id: string;
  display_name: string;
}

export default function KidJoin() {
  const { setKidSession } = useAuth();
  const [, navigate] = useLocation();

  const [familyNumber, setFamilyNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [childrenList, setChildrenList] = useState<ChildOption[] | null>(null);
  const [kidToken, setKidToken] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

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

      const newKidToken = result.kid_token;
      const newFamilyId = result.family_id;
      const kids: ChildOption[] = result.children || [];

      setKidToken(newKidToken);
      setFamilyId(newFamilyId);

      const kidSessionData = {
        familyId: newFamilyId,
        familyNumber: familyNumber.trim().toUpperCase(),
        kidToken: newKidToken,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      if (kids.length === 1) {
        const child = kids[0];
        await supabase.rpc("kid_select_child", {
          p_kid_token: newKidToken,
          p_child_id: child.child_id,
        });
        const fullSession = {
          ...kidSessionData,
          childId: child.child_id,
          childName: child.display_name,
        };
        saveKidSession(fullSession);
        setKidSession(fullSession);
        navigate("/");
      } else {
        saveKidSession(kidSessionData);
        setKidSession(kidSessionData);
        setChildrenList(kids);
      }
    } catch (err: any) {
      const msg = [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ");
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChild = async (child: ChildOption) => {
    if (!kidToken) return;

    setLoading(true);
    try {
      const { error: rpcErr } = await supabase.rpc("kid_select_child", {
        p_kid_token: kidToken,
        p_child_id: child.child_id,
      });

      if (rpcErr) throw rpcErr;

      updateKidSessionChild(child.child_id, child.display_name);
      setKidSession({
        familyId: familyId!,
        familyNumber: familyNumber.trim().toUpperCase(),
        kidToken: kidToken,
        childId: child.child_id,
        childName: child.display_name,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      navigate("/");
    } catch (err: any) {
      setError(err?.message || "Failed to select child");
    } finally {
      setLoading(false);
    }
  };

  if (childrenList) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/30">
              <Users className="w-8 h-8 text-accent-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-kid-select-title">
              Who are you?
            </h1>
            <p className="text-muted-foreground mt-1">Tap your name to start</p>
          </div>

          <div className="space-y-3 mb-6">
            {childrenList.map((child) => (
              <button
                key={child.child_id}
                onClick={() => handleSelectChild(child)}
                disabled={loading}
                className="w-full"
                data-testid={`button-kid-select-${child.child_id}`}
              >
                <Card className="p-5 flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-bold text-lg text-foreground">{child.display_name}</p>
                </Card>
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl mb-4" data-testid="text-kid-select-error">
              {error}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setChildrenList(null); setKidToken(null); setPin(""); }}
            data-testid="button-back-to-join"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

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
