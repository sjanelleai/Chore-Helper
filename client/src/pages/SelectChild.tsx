import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, LogOut, User, Lock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import bcrypt from "bcryptjs";

export default function SelectChild() {
  const { children, family, signOut, selectChild, refreshChildren } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildPin, setNewChildPin] = useState("");
  const [addingChild, setAddingChild] = useState(false);

  const handleChildClick = (childId: string, hasPin: boolean) => {
    if (hasPin) {
      setPinFor(childId);
      setPinInput("");
      setPinError(null);
    } else {
      selectChild(childId);
      navigate("/");
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinFor) return;
    setPinError(null);
    setVerifying(true);

    try {
      const { data: childData, error } = await supabase
        .from("children")
        .select("pin_hash")
        .eq("id", pinFor)
        .single();

      if (error || !childData?.pin_hash) {
        setPinError("Something went wrong. Try again.");
        setVerifying(false);
        return;
      }

      const match = await bcrypt.compare(pinInput, childData.pin_hash);
      setVerifying(false);

      if (match) {
        selectChild(pinFor);
        navigate("/");
      } else {
        setPinError("Wrong PIN. Try again!");
        setPinInput("");
      }
    } catch {
      setPinError("Something went wrong. Try again.");
      setVerifying(false);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;
    if (!family) {
      toast({ title: "Error", description: "Family data not loaded. Please sign out and sign in again.", variant: "destructive" });
      return;
    }

    setAddingChild(true);
    try {
      let pinHash: string | null = null;
      if (newChildPin && newChildPin.length === 4) {
        pinHash = await bcrypt.hash(newChildPin, 10);
      }

      const { data: child, error: insertErr } = await supabase
        .from("children")
        .insert({
          family_id: family.familyId,
          name: newChildName.trim(),
          avatar: null,
          pin_hash: pinHash,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const { error: pointsErr } = await supabase
        .from("child_points")
        .insert({
          child_id: child.id,
          points: 0,
          lifetime_points: 0,
        });

      if (pointsErr) throw pointsErr;

      toast({ title: "Child added!", description: `${newChildName} has been created.` });
      setNewChildName("");
      setNewChildPin("");
      setShowAddChild(false);
      await refreshChildren();
    } catch (err: any) {
      const msg = err?.message || err?.details || "Failed to add child. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAddingChild(false);
    }
  };

  if (pinFor) {
    const child = children.find((c) => c.id === pinFor);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Hi, {child?.name}!
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Enter your 4-digit PIN</p>
          </div>

          <Card className="p-6">
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPinInput(v);
                }}
                inputMode="numeric"
                maxLength={4}
                autoFocus
                placeholder="4-digit PIN"
                className="w-full p-4 rounded-xl border bg-background text-foreground font-mono text-2xl tracking-[0.5em] text-center"
                data-testid="input-child-pin"
              />

              {pinError && (
                <p className="text-sm text-destructive text-center font-medium" data-testid="text-pin-error">{pinError}</p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPinFor(null)}
                  data-testid="button-back-to-selection"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={verifying || pinInput.length < 4} data-testid="button-verify-pin">
                  {verifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Go
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-select-child-title">
            Who's playing?
          </h1>
          <p className="text-muted-foreground mt-1">
            {family?.parentDisplayName || "Your"}'s Family
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {children.length === 0 && !showAddChild && (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No kids added yet!</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first child to get started.</p>
            </div>
          )}

          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => handleChildClick(child.id, child.hasPin)}
              className="w-full"
              data-testid={`button-child-${child.id}`}
            >
              <Card className={cn(
                "p-5 flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/50 cursor-pointer"
              )}>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-lg text-foreground">{child.name}</p>
                </div>
                {child.hasPin && <Lock className="w-4 h-4 text-muted-foreground" />}
              </Card>
            </button>
          ))}
        </div>

        {showAddChild ? (
          <Card className="p-5 mb-4">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Child
            </h3>
            <form onSubmit={handleAddChild} className="space-y-3">
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-1 block">Child's Name</label>
                <input
                  type="text"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  required
                  placeholder="Enter name"
                  className="w-full p-3 rounded-xl border bg-background text-foreground"
                  data-testid="input-child-name"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-1 block">4-Digit PIN (optional)</label>
                <input
                  type="text"
                  value={newChildPin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setNewChildPin(v);
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Leave blank for no PIN"
                  className="w-full p-3 rounded-xl border bg-background text-foreground font-mono tracking-widest"
                  data-testid="input-new-child-pin"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddChild(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={addingChild} data-testid="button-create-child">
                  {addingChild && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Add
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={() => setShowAddChild(true)}
            data-testid="button-add-child"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add a Child
          </Button>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/parent")}
            data-testid="button-parent-settings"
          >
            <Settings className="w-4 h-4 mr-2" />
            Parent Settings
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={signOut}
            data-testid="button-sign-out"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
